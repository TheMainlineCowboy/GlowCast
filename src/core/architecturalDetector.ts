import type { EdgePoint } from "../edgeDetect";
import type { Point } from "../homography";

export type StructuralOrientation = "horizontal" | "vertical";
export type LineSegment = { id: string; orientation: StructuralOrientation; x1: number; y1: number; x2: number; y2: number; length: number; strength: number };
export type CandidateProposal = { id: string; x: number; y: number; width: number; height: number; score: number; contributingLines: number; status: "high" | "low" };
export type ArchitecturalDetectionResult = { lines: LineSegment[]; candidates: CandidateProposal[] };

type Bounds = { x: number; y: number; width: number; height: number };
type DetectorOptions = { bounds?: Bounds | null; polygon?: Point[] | null; maxLines?: number };
type Cell = { gx: number; gy: number; points: EdgePoint[] };

function insidePolygon(point: { x: number; y: number }, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi) inside = !inside;
  }
  return inside;
}

function scopedPoints(edgePoints: EdgePoint[], options: DetectorOptions) {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const polygon = options.polygon && options.polygon.length >= 3 ? options.polygon : null;
  return edgePoints.filter((point) => point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height && (!polygon || insidePolygon(point, polygon)));
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)))];
}

function makeLine(points: EdgePoint[], orientation: StructuralOrientation, id: string): LineSegment | null {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const length = orientation === "horizontal" ? x2 - x1 : y2 - y1;
  if (length < 0.8) return null;
  return { id, orientation, x1, y1, x2, y2, length, strength: points.reduce((sum, p) => sum + p.strength, 0) / points.length };
}

function buildLineSegments(points: EdgePoint[], orientation: StructuralOrientation, options: DetectorOptions): LineSegment[] {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const binSize = 1.2;
  const bins = new Map<number, EdgePoint[]>();
  for (const point of points) {
    const key = Math.round((orientation === "horizontal" ? point.y : point.x) / binSize);
    const list = bins.get(key) ?? [];
    list.push(point);
    bins.set(key, list);
  }
  const lines: LineSegment[] = [];
  for (const [key, binPoints] of bins) {
    if (binPoints.length < 2) continue;
    const line = makeLine(binPoints, orientation, `${orientation}-${key}`);
    if (line && line.length >= Math.max(1.2, (orientation === "horizontal" ? bounds.width : bounds.height) * 0.018)) lines.push(line);
  }
  return lines.sort((a, b) => b.length * b.strength - a.length * a.strength).slice(0, options.maxLines ?? 160);
}

function overlaps(a: CandidateProposal, b: CandidateProposal) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

function countPoints(points: EdgePoint[], x: number, y: number, width: number, height: number) {
  let count = 0;
  let strength = 0;
  for (const point of points) {
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      count++;
      strength += point.strength;
    }
  }
  return { count, strength };
}

function perimeterSupport(points: EdgePoint[], x: number, y: number, width: number, height: number) {
  const band = Math.max(1.1, Math.min(width, height) * 0.18);
  let count = 0;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  for (const point of points) {
    if (point.x < x || point.x > x + width || point.y < y || point.y > y + height) continue;
    const nearTop = Math.abs(point.y - y) <= band;
    const nearBottom = Math.abs(point.y - (y + height)) <= band;
    const nearLeft = Math.abs(point.x - x) <= band;
    const nearRight = Math.abs(point.x - (x + width)) <= band;
    if (nearTop || nearBottom || nearLeft || nearRight) count++;
    if (nearTop) top++;
    if (nearBottom) bottom++;
    if (nearLeft) left++;
    if (nearRight) right++;
  }
  return { count, sides: [top, bottom, left, right].filter((value) => value >= 2).length };
}

function interiorStructure(points: EdgePoint[], x: number, y: number, width: number, height: number) {
  const innerX = x + width * 0.16;
  const innerY = y + height * 0.16;
  const innerW = width * 0.68;
  const innerH = height * 0.68;
  let count = 0;
  const xBands = new Set<number>();
  const yBands = new Set<number>();
  const quadrants = new Set<string>();
  for (const point of points) {
    if (point.x < innerX || point.x > innerX + innerW || point.y < innerY || point.y > innerY + innerH) continue;
    count++;
    xBands.add(Math.floor(((point.x - innerX) / innerW) * 4));
    yBands.add(Math.floor(((point.y - innerY) / innerH) * 4));
    quadrants.add(`${point.x < x + width / 2 ? "L" : "R"}${point.y < y + height / 2 ? "T" : "B"}`);
  }
  return { count, xBands: xBands.size, yBands: yBands.size, quadrants: quadrants.size };
}

function lineSupport(lines: LineSegment[], x: number, y: number, width: number, height: number, orientation: StructuralOrientation) {
  let count = 0;
  for (const line of lines) {
    if (line.orientation !== orientation) continue;
    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    const overlapsX = line.x2 >= x && line.x1 <= x + width;
    const overlapsY = line.y2 >= y && line.y1 <= y + height;
    if (centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height) count++;
    else if (orientation === "horizontal" && overlapsX && centerY >= y && centerY <= y + height) count++;
    else if (orientation === "vertical" && overlapsY && centerX >= x && centerX <= x + width) count++;
  }
  return count;
}

function connectedEdgeComponents(points: EdgePoint[], surface: Bounds) {
  if (!points.length) return [] as EdgePoint[][];
  const strengths = points.map((point) => point.strength).sort((a, b) => a - b);
  const cutoff = strengths[Math.floor(strengths.length * 0.58)] ?? 0;
  const strongPoints = points.filter((point) => point.strength >= cutoff);
  const cellSize = Math.max(0.9, Math.min(surface.width, surface.height) * 0.018);
  const cells = new Map<string, Cell>();

  for (const point of strongPoints) {
    const gx = Math.floor((point.x - surface.x) / cellSize);
    const gy = Math.floor((point.y - surface.y) / cellSize);
    const key = `${gx},${gy}`;
    const existing = cells.get(key);
    if (existing) existing.points.push(point);
    else cells.set(key, { gx, gy, points: [point] });
  }

  for (const [key, cell] of [...cells.entries()]) {
    const avg = cell.points.reduce((sum, point) => sum + point.strength, 0) / cell.points.length;
    if (cell.points.length < 2 && avg < cutoff * 1.25) cells.delete(key);
  }

  const seen = new Set<string>();
  const components: EdgePoint[][] = [];
  for (const [key, start] of cells) {
    if (seen.has(key)) continue;
    const stack = [start];
    const component: EdgePoint[] = [];
    seen.add(key);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(...current.points);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = `${current.gx + dx},${current.gy + dy}`;
          if (seen.has(nextKey)) continue;
          const next = cells.get(nextKey);
          if (!next) continue;
          seen.add(nextKey);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function componentToCandidate(component: EdgePoint[], allPoints: EdgePoint[], lines: LineSegment[], surface: Bounds, index: number): CandidateProposal | null {
  if (component.length < 7) return null;
  const xs = component.map((point) => point.x);
  const ys = component.map((point) => point.y);
  const pad = Math.max(0.8, Math.min(surface.width, surface.height) * 0.012);
  const x = Math.max(surface.x, quantile(xs, 0.04) - pad);
  const y = Math.max(surface.y, quantile(ys, 0.04) - pad);
  const right = Math.min(surface.x + surface.width, quantile(xs, 0.96) + pad);
  const bottom = Math.min(surface.y + surface.height, quantile(ys, 0.96) + pad);
  const width = right - x;
  const height = bottom - y;
  const area = width * height;
  const surfaceArea = surface.width * surface.height;
  const aspect = width / Math.max(0.001, height);

  if (width < surface.width * 0.08 || height < surface.height * 0.08) return null;
  if (width > surface.width * 0.46 || height > surface.height * 0.46) return null;
  if (area < surfaceArea * 0.012 || area > surfaceArea * 0.18) return null;
  if (aspect < 0.45 || aspect > 3.20) return null;

  const marginX = surface.width * 0.018;
  const marginY = surface.height * 0.018;
  if (x <= surface.x + marginX || y <= surface.y + marginY || x + width >= surface.x + surface.width - marginX || y + height >= surface.y + surface.height - marginY) return null;

  const border = perimeterSupport(allPoints, x, y, width, height);
  const interior = interiorStructure(allPoints, x, y, width, height);
  const hLines = lineSupport(lines, x, y, width, height, "horizontal");
  const vLines = lineSupport(lines, x, y, width, height, "vertical");
  const points = countPoints(allPoints, x, y, width, height);
  const density = component.length / Math.max(1, area);

  const isArchLike = aspect >= 1.15 && height <= surface.height * 0.27 && y <= surface.y + surface.height * 0.45;
  const isRectLike = aspect >= 0.55 && aspect <= 1.90;
  if (!isArchLike && !isRectLike) return null;

  if (isRectLike) {
    if (border.count < 5 || border.sides < 2) return null;
    if (interior.count < 3 || interior.xBands < 2 || interior.yBands < 2) return null;
    if (hLines < 1 || vLines < 1 || hLines + vLines < 3) return null;
  }

  if (isArchLike) {
    if (interior.count < 2 || interior.xBands < 2) return null;
    if (hLines < 1 || vLines < 1) return null;
  }

  const specklePenalty = Math.max(0, points.count - component.length - border.count - interior.count) * 1.35;
  const score = Math.round(component.length * 2.5 + border.count * 1.9 + interior.count * 2.7 + hLines * 11 + vLines * 11 + Math.min(20, density * 140) - specklePenalty);
  if (score < 38) return null;

  return {
    id: `edge-component-${index}`,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    score,
    contributingLines: hLines + vLines,
    status: score >= 70 ? "high" : "low"
  };
}

function componentCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  return connectedEdgeComponents(points, surface)
    .map((component, index) => componentToCandidate(component, points, lines, surface, index))
    .filter((candidate): candidate is CandidateProposal => Boolean(candidate))
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.35 && other.score >= candidate.score) === -1)
    .slice(0, 8);
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical].slice(0, 160);
  return { lines, candidates: componentCandidates(points, lines, surface) };
}
