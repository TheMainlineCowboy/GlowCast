import type { EdgePoint } from "../edgeDetect";
import type { Point } from "../homography";

export type StructuralOrientation = "horizontal" | "vertical";
export type LineSegment = { id: string; orientation: StructuralOrientation; x1: number; y1: number; x2: number; y2: number; length: number; strength: number };
export type CandidateProposal = { id: string; x: number; y: number; width: number; height: number; score: number; contributingLines: number; status: "high" | "low" };
export type ArchitecturalDetectionResult = { lines: LineSegment[]; candidates: CandidateProposal[] };

type Bounds = { x: number; y: number; width: number; height: number };
type DetectorOptions = { bounds?: Bounds | null; polygon?: Point[] | null; maxLines?: number };
type GridCell = { gx: number; gy: number; points: EdgePoint[] };

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

function candidateFromComponent(points: EdgePoint[], surface: Bounds, index: number): CandidateProposal | null {
  if (points.length < 18) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const pad = Math.max(1.6, Math.min(surface.width, surface.height) * 0.025);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const surfaceArea = surface.width * surface.height;
  const area = width * height;
  const aspect = width / Math.max(0.001, height);
  const marginX = surface.width * 0.025;
  const marginY = surface.height * 0.025;

  if (width < surface.width * 0.12) return null;
  if (height < surface.height * 0.10) return null;
  if (width > surface.width * 0.48) return null;
  if (height > surface.height * 0.45) return null;
  if (area < surfaceArea * 0.018 || area > surfaceArea * 0.18) return null;
  if (aspect < 0.45 || aspect > 3.0) return null;
  if (x <= surface.x + marginX || y <= surface.y + marginY || x + width >= surface.x + surface.width - marginX || y + height >= surface.y + surface.height - marginY) return null;

  const density = points.length / Math.max(1, area);
  const score = Math.round(55 + Math.min(30, points.length * 0.7) + Math.min(20, density * 140));
  return {
    id: `component-${index}-${Math.round(x * 10)}-${Math.round(y * 10)}`,
    x: Number(Math.max(surface.x, x).toFixed(2)),
    y: Number(Math.max(surface.y, y).toFixed(2)),
    width: Number(Math.min(width, surface.x + surface.width - Math.max(surface.x, x)).toFixed(2)),
    height: Number(Math.min(height, surface.y + surface.height - Math.max(surface.y, y)).toFixed(2)),
    score,
    contributingLines: Math.max(1, Math.round(points.length / 10)),
    status: score >= 70 ? "high" : "low"
  };
}

function componentCandidates(points: EdgePoint[], surface: Bounds): CandidateProposal[] {
  const cell = Math.max(2.2, Math.min(surface.width, surface.height) * 0.055);
  const occupied = new Map<string, GridCell>();
  for (const point of points) {
    const gx = Math.floor((point.x - surface.x) / cell);
    const gy = Math.floor((point.y - surface.y) / cell);
    const key = `${gx},${gy}`;
    const existing = occupied.get(key);
    if (existing) existing.points.push(point);
    else occupied.set(key, { gx, gy, points: [point] });
  }

  const seen = new Set<string>();
  const components: EdgePoint[][] = [];
  for (const [key, start] of occupied) {
    if (seen.has(key)) continue;
    const stack = [start];
    const comp: EdgePoint[] = [];
    seen.add(key);
    while (stack.length) {
      const cellInfo = stack.pop()!;
      comp.push(...cellInfo.points);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nKey = `${cellInfo.gx + dx},${cellInfo.gy + dy}`;
          if (seen.has(nKey)) continue;
          const next = occupied.get(nKey);
          if (!next) continue;
          seen.add(nKey);
          stack.push(next);
        }
      }
    }
    components.push(comp);
  }

  return components
    .map((comp, index) => candidateFromComponent(comp, surface, index))
    .filter((candidate): candidate is CandidateProposal => Boolean(candidate))
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.40 && other.score >= candidate.score) === -1)
    .slice(0, 8);
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  return { lines: [...horizontal, ...vertical].slice(0, 160), candidates: componentCandidates(points, surface) };
}
