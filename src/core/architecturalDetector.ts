import type { EdgePoint } from "../edgeDetect";
import type { Point } from "../homography";

export type StructuralOrientation = "horizontal" | "vertical";
export type LineSegment = { id: string; orientation: StructuralOrientation; x1: number; y1: number; x2: number; y2: number; length: number; strength: number };
export type CandidateProposal = { id: string; x: number; y: number; width: number; height: number; score: number; contributingLines: number; status: "high" | "low" };
export type ArchitecturalDetectionResult = { lines: LineSegment[]; candidates: CandidateProposal[] };

type Bounds = { x: number; y: number; width: number; height: number };
type DetectorOptions = { bounds?: Bounds | null; polygon?: Point[] | null; maxLines?: number };

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

function candidateFromBounds(bounds: Bounds, surface: Bounds, score: number, index: number): CandidateProposal | null {
  const area = bounds.width * bounds.height;
  const surfaceArea = surface.width * surface.height;
  if (bounds.width < 2 || bounds.height < 2) return null;
  if (area > surfaceArea * 0.22) return null;
  const x = Math.max(surface.x, Math.min(surface.x + surface.width - 1, bounds.x));
  const y = Math.max(surface.y, Math.min(surface.y + surface.height - 1, bounds.y));
  const width = Math.max(1.5, Math.min(bounds.width, surface.x + surface.width - x));
  const height = Math.max(1.5, Math.min(bounds.height, surface.y + surface.height - y));
  return { id: `cand-${index}-${Math.round(x * 10)}-${Math.round(y * 10)}`, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), width: Number(width.toFixed(2)), height: Number(height.toFixed(2)), score, contributingLines: 1, status: score >= 70 ? "high" : "low" };
}

function denseComponentCandidates(points: EdgePoint[], surface: Bounds): CandidateProposal[] {
  const cell = Math.max(1.4, Math.min(surface.width, surface.height) * 0.028);
  const buckets = new Map<string, EdgePoint[]>();
  for (const point of points) {
    const key = `${Math.floor((point.x - surface.x) / cell)},${Math.floor((point.y - surface.y) / cell)}`;
    const list = buckets.get(key) ?? [];
    list.push(point);
    buckets.set(key, list);
  }
  const out: CandidateProposal[] = [];
  let i = 0;
  const pad = Math.max(1.4, Math.min(surface.width, surface.height) * 0.025);
  for (const list of buckets.values()) {
    const xs = list.map((p) => p.x), ys = list.map((p) => p.y);
    const c = candidateFromBounds({ x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 }, surface, 45, i++);
    if (c) out.push(c);
  }
  return out;
}

function lineCandidates(lines: LineSegment[], surface: Bounds): CandidateProposal[] {
  const out: CandidateProposal[] = [];
  const minSide = Math.min(surface.width, surface.height);
  for (const [i, line] of lines.slice(0, 60).entries()) {
    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    const longSide = Math.max(line.length, minSide * 0.05);
    const shortSide = Math.max(minSide * 0.045, Math.min(minSide * 0.14, longSide * 0.5));
    const bounds = line.orientation === "horizontal" ? { x: centerX - longSide / 2, y: centerY - shortSide / 2, width: longSide, height: shortSide } : { x: centerX - shortSide / 2, y: centerY - longSide / 2, width: shortSide, height: longSide };
    const c = candidateFromBounds(bounds, surface, 50, i);
    if (c) out.push(c);
  }
  return out;
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical];
  const raw = [...lineCandidates(lines, surface), ...denseComponentCandidates(points, surface)];
  const candidates = raw.sort((a, b) => b.score - a.score).filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.55 && other.score >= candidate.score) === -1).slice(0, 60);
  return { lines: lines.slice(0, 160), candidates };
}
