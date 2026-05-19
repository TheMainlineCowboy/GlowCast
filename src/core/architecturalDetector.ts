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

function buildLineSegments(points: EdgePoint[], orientation: StructuralOrientation, options: DetectorOptions): LineSegment[] {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const minLength = Math.max(2.8, (orientation === "horizontal" ? bounds.width : bounds.height) * 0.038);
  const binSize = 2.2;
  const runGap = 9.5;
  const bins = new Map<number, EdgePoint[]>();
  for (const point of points) {
    const key = Math.round((orientation === "horizontal" ? point.y : point.x) / binSize);
    const list = bins.get(key) ?? [];
    list.push(point);
    bins.set(key, list);
  }
  const lines: LineSegment[] = [];
  for (const [key, binPoints] of bins) {
    const sorted = [...binPoints].sort((a, b) => orientation === "horizontal" ? a.x - b.x : a.y - b.y);
    let run: EdgePoint[] = [];
    const flush = () => {
      if (run.length < 3) { run = []; return; }
      const xs = run.map((p) => p.x), ys = run.map((p) => p.y);
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      const length = orientation === "horizontal" ? x2 - x1 : y2 - y1;
      if (length < minLength) { run = []; return; }
      const center = key * binSize;
      lines.push({
        id: `${orientation}-${key}-${lines.length}`,
        orientation,
        x1: orientation === "horizontal" ? x1 : center,
        y1: orientation === "horizontal" ? center : y1,
        x2: orientation === "horizontal" ? x2 : center,
        y2: orientation === "horizontal" ? center : y2,
        length,
        strength: run.reduce((sum, p) => sum + p.strength, 0) / run.length
      });
      run = [];
    };
    for (const point of sorted) {
      if (!run.length) { run.push(point); continue; }
      const previous = run[run.length - 1];
      const gap = orientation === "horizontal" ? point.x - previous.x : point.y - previous.y;
      if (gap <= runGap) run.push(point); else { flush(); run.push(point); }
    }
    flush();
  }
  return lines.sort((a, b) => b.length * b.strength - a.length * a.strength).slice(0, options.maxLines ?? 180);
}

function overlapLen(a1: number, a2: number, b1: number, b2: number) { return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)); }
function overlapRatio(a: CandidateProposal, b: CandidateProposal) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

function makeCandidate(bounds: Bounds, surface: Bounds, contributingLines: number): CandidateProposal | null {
  const surfaceArea = Math.max(1, surface.width * surface.height);
  const area = bounds.width * bounds.height;
  const aspect = bounds.width / Math.max(0.01, bounds.height);
  if (area < surfaceArea * 0.003 || area > surfaceArea * 0.34) return null;
  if (bounds.width < 4.4 || bounds.height < 4.4) return null;
  if (aspect < 0.22 || aspect > 5.4) return null;
  let score = contributingLines * 18;
  if (contributingLines >= 3) score += 18;
  if (aspect >= 0.5 && aspect <= 2.9) score += 20;
  if (area >= surfaceArea * 0.012 && area <= surfaceArea * 0.20) score += 16;
  return { id: `arch-${Math.round(bounds.x * 10)}-${Math.round(bounds.y * 10)}-${Math.round(bounds.width * 10)}-${Math.round(bounds.height * 10)}`, x: Number(bounds.x.toFixed(2)), y: Number(bounds.y.toFixed(2)), width: Number(bounds.width.toFixed(2)), height: Number(bounds.height.toFixed(2)), score: Math.min(99, Math.round(score)), contributingLines, status: score >= 70 ? "high" : "low" };
}

function addPairCandidates(horizontal: LineSegment[], vertical: LineSegment[], surface: Bounds, proposals: CandidateProposal[]) {
  for (const top of horizontal) for (const bottom of horizontal) {
    if (bottom.y1 <= top.y1 + 4.2) continue;
    const sharedX1 = Math.max(top.x1, bottom.x1);
    const sharedX2 = Math.min(top.x2, bottom.x2);
    const width = sharedX2 - sharedX1;
    const height = bottom.y1 - top.y1;
    if (width < 4.5 || height < 4.5 || height > surface.height * 0.8) continue;
    const c = makeCandidate({ x: sharedX1, y: top.y1, width, height }, surface, 2);
    if (c) proposals.push(c);
  }
  for (const left of vertical) for (const right of vertical) {
    if (right.x1 <= left.x1 + 4.2) continue;
    const sharedY1 = Math.max(left.y1, right.y1);
    const sharedY2 = Math.min(left.y2, right.y2);
    const width = right.x1 - left.x1;
    const height = sharedY2 - sharedY1;
    if (width < 4.5 || height < 4.5 || width > surface.width * 0.8) continue;
    const c = makeCandidate({ x: left.x1, y: sharedY1, width, height }, surface, 2);
    if (c) proposals.push(c);
  }
  for (const h of horizontal) for (const v of vertical) {
    const crosses = v.x1 >= h.x1 - 3 && v.x1 <= h.x2 + 3 && h.y1 >= v.y1 - 3 && h.y1 <= v.y2 + 3;
    if (!crosses) continue;
    const width = Math.min(h.length, surface.width * 0.28);
    const height = Math.min(v.length, surface.height * 0.28);
    const c = makeCandidate({ x: Math.max(surface.x, v.x1 - width / 2), y: Math.max(surface.y, h.y1 - height / 2), width, height }, surface, 2);
    if (c) proposals.push(c);
  }
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical];
  const proposals: CandidateProposal[] = [];
  addPairCandidates(horizontal, vertical, lines.length ? surface : surface, proposals);
  const candidates = proposals.sort((a, b) => b.score - a.score).filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlapRatio(other, candidate) > 0.62 && other.score >= candidate.score) === -1).slice(0, 24);
  return { lines: lines.slice(0, 180), candidates };
}
