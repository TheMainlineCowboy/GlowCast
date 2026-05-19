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
  const minLength = Math.max(2.2, (orientation === "horizontal" ? bounds.width : bounds.height) * 0.032);
  const binSize = 2.4;
  const runGap = 11;
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
      if (run.length < 2) { run = []; return; }
      const xs = run.map((p) => p.x), ys = run.map((p) => p.y);
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      const length = orientation === "horizontal" ? x2 - x1 : y2 - y1;
      if (length < minLength) { run = []; return; }
      const center = key * binSize;
      lines.push({ id: `${orientation}-${key}-${lines.length}`, orientation, x1: orientation === "horizontal" ? x1 : center, y1: orientation === "horizontal" ? center : y1, x2: orientation === "horizontal" ? x2 : center, y2: orientation === "horizontal" ? center : y2, length, strength: run.reduce((sum, p) => sum + p.strength, 0) / run.length });
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
  return lines.sort((a, b) => b.length * b.strength - a.length * a.strength).slice(0, options.maxLines ?? 200);
}

function overlapRatio(a: CandidateProposal, b: CandidateProposal) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

function touchesSurfaceEdge(bounds: Bounds, surface: Bounds) {
  const marginX = Math.max(2.5, surface.width * 0.035);
  const marginY = Math.max(2.5, surface.height * 0.035);
  return bounds.x <= surface.x + marginX || bounds.y <= surface.y + marginY || bounds.x + bounds.width >= surface.x + surface.width - marginX || bounds.y + bounds.height >= surface.y + surface.height - marginY;
}

function makeCandidate(bounds: Bounds, surface: Bounds, contributingLines: number): CandidateProposal | null {
  if (touchesSurfaceEdge(bounds, surface)) return null;
  const surfaceArea = Math.max(1, surface.width * surface.height);
  const area = bounds.width * bounds.height;
  const aspect = bounds.width / Math.max(0.01, bounds.height);
  if (area < surfaceArea * 0.0012 || area > surfaceArea * 0.18) return null;
  if (bounds.width < 2.8 || bounds.height < 2.8) return null;
  if (aspect < 0.2 || aspect > 5.5) return null;
  let score = contributingLines * 18;
  if (contributingLines >= 3) score += 18;
  if (aspect >= 0.42 && aspect <= 3.4) score += 20;
  if (area >= surfaceArea * 0.007 && area <= surfaceArea * 0.12) score += 16;
  return { id: `arch-${Math.round(bounds.x * 10)}-${Math.round(bounds.y * 10)}-${Math.round(bounds.width * 10)}-${Math.round(bounds.height * 10)}`, x: Number(bounds.x.toFixed(2)), y: Number(bounds.y.toFixed(2)), width: Number(bounds.width.toFixed(2)), height: Number(bounds.height.toFixed(2)), score: Math.min(99, Math.round(score)), contributingLines, status: score >= 70 ? "high" : "low" };
}

function addObjectScaleLineCandidates(lines: LineSegment[], surface: Bounds, proposals: CandidateProposal[]) {
  const strong = lines.filter((line) => line.x1 > surface.x + surface.width * 0.06 && line.x2 < surface.x + surface.width * 0.94 && line.y1 > surface.y + surface.height * 0.06 && line.y2 < surface.y + surface.height * 0.94).slice(0, 100);
  for (const line of strong) {
    const longSide = line.length;
    const shortSide = Math.max(Math.min(surface.width, surface.height) * 0.085, longSide * 0.55);
    if (line.orientation === "horizontal") {
      const c = makeCandidate({ x: line.x1, y: line.y1 - shortSide / 2, width: longSide, height: shortSide }, surface, 1);
      if (c) proposals.push(c);
    } else {
      const c = makeCandidate({ x: line.x1 - shortSide / 2, y: line.y1, width: shortSide, height: longSide }, surface, 1);
      if (c) proposals.push(c);
    }
  }
}

function addComponentCandidates(points: EdgePoint[], surface: Bounds, proposals: CandidateProposal[]) {
  const cell = Math.max(3, Math.min(surface.width, surface.height) * 0.055);
  const buckets = new Map<string, EdgePoint[]>();
  for (const p of points) {
    if (p.x <= surface.x + surface.width * 0.05 || p.x >= surface.x + surface.width * 0.95 || p.y <= surface.y + surface.height * 0.05 || p.y >= surface.y + surface.height * 0.95) continue;
    const key = `${Math.floor((p.x - surface.x) / cell)},${Math.floor((p.y - surface.y) / cell)}`;
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }
  const pad = Math.max(2.5, Math.min(surface.width, surface.height) * 0.04);
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const xs = list.map((p) => p.x), ys = list.map((p) => p.y);
    const x = Math.max(surface.x, Math.min(...xs) - pad);
    const y = Math.max(surface.y, Math.min(...ys) - pad);
    const w = Math.min(surface.x + surface.width, Math.max(...xs) + pad) - x;
    const h = Math.min(surface.y + surface.height, Math.max(...ys) + pad) - y;
    const c = makeCandidate({ x, y, width: w, height: h }, surface, 1);
    if (c) proposals.push(c);
  }
}

function addPairCandidates(horizontal: LineSegment[], vertical: LineSegment[], surface: Bounds, proposals: CandidateProposal[]) {
  for (const h of horizontal) for (const v of vertical) {
    const near = v.x1 >= h.x1 - 8 && v.x1 <= h.x2 + 8 && h.y1 >= v.y1 - 8 && h.y1 <= v.y2 + 8;
    if (!near) continue;
    const w = Math.max(5, Math.min(h.length * 1.35, surface.width * 0.25));
    const hgt = Math.max(5, Math.min(v.length * 1.35, surface.height * 0.25));
    const c = makeCandidate({ x: Math.max(surface.x, v.x1 - w / 2), y: Math.max(surface.y, h.y1 - hgt / 2), width: w, height: hgt }, surface, 2);
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
  addPairCandidates(horizontal, vertical, surface, proposals);
  addObjectScaleLineCandidates(lines, surface, proposals);
  addComponentCandidates(points, surface, proposals);
  const candidates = proposals.sort((a, b) => b.score - a.score).filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlapRatio(other, candidate) > 0.5 && other.score >= candidate.score) === -1).slice(0, 36);
  return { lines: lines.slice(0, 200), candidates };
}
