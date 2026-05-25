import type { EdgePoint } from "../edgeDetect";
import type { Point } from "../homography";

export type StructuralOrientation = "horizontal" | "vertical";

export type LineSegment = {
  id: string;
  orientation: StructuralOrientation;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  strength: number;
};

export type CandidateProposal = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  contributingLines: number;
  status: "high" | "low";
};

export type ArchitecturalDetectionResult = {
  lines: LineSegment[];
  candidates: CandidateProposal[];
};

type Bounds = { x: number; y: number; width: number; height: number };
type DetectorOptions = { bounds?: Bounds | null; polygon?: Point[] | null; maxLines?: number };
type Cell = { gx: number; gy: number; points: EdgePoint[] };
type ComponentBox = { points: EdgePoint[]; x: number; y: number; width: number; height: number; cx: number; cy: number };

function insidePolygon(point: { x: number; y: number }, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
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
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);
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

function connectedEdgeComponents(points: EdgePoint[], surface: Bounds) {
  if (!points.length) return [] as EdgePoint[][];
  const strengths = points.map((point) => point.strength).sort((a, b) => a - b);
  const cutoff = strengths[Math.floor(strengths.length * 0.45)] ?? 0;
  const strongPoints = points.filter((point) => point.strength >= cutoff);
  const cellSize = Math.max(1.4, Math.min(surface.width, surface.height) * 0.035);
  const cells = new Map<string, Cell>();

  for (const point of strongPoints) {
    const gx = Math.floor((point.x - surface.x) / cellSize);
    const gy = Math.floor((point.y - surface.y) / cellSize);
    const key = `${gx},${gy}`;
    const existing = cells.get(key);
    if (existing) existing.points.push(point);
    else cells.set(key, { gx, gy, points: [point] });
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
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
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

function componentBox(points: EdgePoint[], surface: Bounds): ComponentBox | null {
  if (points.length < 4) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const pad = Math.max(1.1, Math.min(surface.width, surface.height) * 0.018);
  const x = Math.max(surface.x, quantile(xs, 0.02) - pad);
  const y = Math.max(surface.y, quantile(ys, 0.02) - pad);
  const right = Math.min(surface.x + surface.width, quantile(xs, 0.98) + pad);
  const bottom = Math.min(surface.y + surface.height, quantile(ys, 0.98) + pad);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return { points, x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

function lineSupport(lines: LineSegment[], x: number, y: number, width: number, height: number) {
  let count = 0;
  for (const line of lines) {
    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    if (centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height) count++;
  }
  return count;
}

function boxToCandidate(box: ComponentBox, _allPoints: EdgePoint[], lines: LineSegment[], surface: Bounds, id: string): CandidateProposal | null {
  const { x, y, width, height } = box;
  const area = width * height;
  const surfaceArea = surface.width * surface.height;
  const aspect = width / Math.max(0.001, height);

  if (width < surface.width * 0.045 || height < surface.height * 0.045) return null;
  if (width > surface.width * 0.62 || height > surface.height * 0.72) return null;
  if (area < surfaceArea * 0.0035 || area > surfaceArea * 0.28) return null;
  if (aspect < 0.18 || aspect > 5.8) return null;

  const edgeMarginX = surface.width * 0.012;
  const edgeMarginY = surface.height * 0.012;
  if (x <= surface.x + edgeMarginX || y <= surface.y + edgeMarginY || x + width >= surface.x + surface.width - edgeMarginX || y + height >= surface.y + surface.height - edgeMarginY) {
    if (area > surfaceArea * 0.055) return null;
  }

  const avgStrength = box.points.reduce((sum, point) => sum + point.strength, 0) / Math.max(1, box.points.length);
  const support = lineSupport(lines, x, y, width, height);
  const shapeBonus = aspect >= 0.55 && aspect <= 1.75 ? 18 : aspect >= 0.25 && aspect <= 3.4 ? 8 : 0;
  const score = Math.round(Math.min(99, box.points.length * 2.2 + avgStrength / 7 + support * 5 + shapeBonus));
  if (score < 24) return null;

  return {
    id,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    score,
    contributingLines: Math.max(1, support),
    status: score >= 58 ? "high" : "low"
  };
}

function componentCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  return connectedEdgeComponents(points, surface)
    .map((component) => componentBox(component, surface))
    .filter((box): box is ComponentBox => Boolean(box))
    .map((box, index) => boxToCandidate(box, points, lines, surface, `edge-component-${index}`))
    .filter((candidate): candidate is CandidateProposal => Boolean(candidate))
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.32 && other.score >= candidate.score) === -1)
    .slice(0, 10);
}

function gridFallbackCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  if (!points.length) return [] as CandidateProposal[];
  const cellW = surface.width / 14;
  const cellH = surface.height / 8;
  const buckets = new Map<string, EdgePoint[]>();
  for (const point of points) {
    const gx = Math.floor((point.x - surface.x) / cellW);
    const gy = Math.floor((point.y - surface.y) / cellH);
    const key = `${gx},${gy}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }

  const dense = [...buckets.entries()].filter(([, bucket]) => bucket.length >= 3);
  const used = new Set<string>();
  const candidates: CandidateProposal[] = [];

  for (const [key] of dense) {
    if (used.has(key)) continue;
    const [sx, sy] = key.split(",").map(Number);
    const stack = [[sx, sy]];
    const cluster: EdgePoint[] = [];
    used.add(key);

    while (stack.length) {
      const [gx, gy] = stack.pop()!;
      const currentKey = `${gx},${gy}`;
      const bucket = buckets.get(currentKey);
      if (bucket) cluster.push(...bucket);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nextKey = `${gx + dx},${gy + dy}`;
          if (used.has(nextKey)) continue;
          const next = buckets.get(nextKey);
          if (!next || next.length < 3) continue;
          used.add(nextKey);
          stack.push([gx + dx, gy + dy]);
        }
      }
    }

    const box = componentBox(cluster, surface);
    const candidate = box ? boxToCandidate(box, points, lines, surface, `grid-fallback-${candidates.length}`) : null;
    if (candidate) candidates.push(candidate);
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.30 && other.score >= candidate.score) === -1)
    .slice(0, 10);
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical].slice(0, 160);

  let candidates = componentCandidates(points, lines, surface);
  if (candidates.length === 0 && points.length) candidates = gridFallbackCandidates(points, lines, surface);

  candidates = candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.38 && other.score >= candidate.score) === -1)
    .slice(0, 10);

  return { lines, candidates };
}
