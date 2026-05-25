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

function overlaps(a: CandidateProposal, b: CandidateProposal) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
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

function countInBox(points: EdgePoint[], x: number, y: number, width: number, height: number) {
  let count = 0;
  let strength = 0;
  for (const point of points) {
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      count += 1;
      strength += point.strength;
    }
  }
  return { count, strength };
}

function lineSupport(lines: LineSegment[], x: number, y: number, width: number, height: number) {
  let count = 0;
  for (const line of lines) {
    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    if (centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height) count += 1;
  }
  return count;
}

function candidateFromBox(points: EdgePoint[], lines: LineSegment[], surface: Bounds, x: number, y: number, width: number, height: number, id: string): CandidateProposal | null {
  const area = width * height;
  const surfaceArea = surface.width * surface.height;
  const aspect = width / Math.max(0.001, height);
  if (width < surface.width * 0.04 || height < surface.height * 0.04) return null;
  if (width > surface.width * 0.52 || height > surface.height * 0.68) return null;
  if (area < surfaceArea * 0.002 || area > surfaceArea * 0.20) return null;
  if (aspect < 0.18 || aspect > 5.2) return null;

  const support = countInBox(points, x, y, width, height);
  if (support.count < 2) return null;

  const lineCount = lineSupport(lines, x, y, width, height);
  const shapeBonus = aspect >= 0.55 && aspect <= 1.8 ? 18 : aspect >= 0.28 && aspect <= 3.2 ? 9 : 0;
  const score = Math.round(Math.min(99, support.count * 10 + support.strength / 60 + lineCount * 4 + shapeBonus));
  if (score < 22) return null;

  return {
    id,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    score,
    contributingLines: Math.max(1, lineCount),
    status: score >= 50 ? "high" : "low"
  };
}

function pointClusterCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  if (!points.length) return [] as CandidateProposal[];
  const sorted = [...points].sort((a, b) => b.strength - a.strength);
  const picked: CandidateProposal[] = [];
  const sizes = [
    { w: 0.15, h: 0.24 },
    { w: 0.14, h: 0.20 },
    { w: 0.18, h: 0.20 },
    { w: 0.20, h: 0.24 },
    { w: 0.18, h: 0.18 },
    { w: 0.26, h: 0.20 },
    { w: 0.14, h: 0.34 }
  ];
  let id = 0;
  for (const point of sorted) {
    if (picked.length >= 12) break;
    for (const size of sizes) {
      const width = surface.width * size.w;
      const height = surface.height * size.h;
      const x = Math.max(surface.x, Math.min(surface.x + surface.width - width, point.x - width / 2));
      const y = Math.max(surface.y, Math.min(surface.y + surface.height - height, point.y - height / 2));
      const candidate = candidateFromBox(points, lines, surface, x, y, width, height, `seed-${id++}`);
      if (!candidate) continue;
      if (picked.some((other) => overlaps(other, candidate) > 0.34)) continue;
      picked.push(candidate);
      break;
    }
  }
  return picked;
}

function cellSweepCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  const candidates: CandidateProposal[] = [];
  let id = 0;
  const widths = [0.12, 0.16, 0.20, 0.26, 0.32].map((v) => surface.width * v);
  const heights = [0.16, 0.22, 0.28, 0.36].map((v) => surface.height * v);
  const stepX = surface.width * 0.035;
  const stepY = surface.height * 0.045;
  for (const width of widths) {
    for (const height of heights) {
      for (let y = surface.y; y <= surface.y + surface.height - height; y += stepY) {
        for (let x = surface.x; x <= surface.x + surface.width - width; x += stepX) {
          const candidate = candidateFromBox(points, lines, surface, x, y, width, height, `sweep-${id++}`);
          if (candidate) candidates.push(candidate);
        }
      }
    }
  }
  return candidates;
}

function practicalCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  return [...pointClusterCandidates(points, lines, surface), ...cellSweepCandidates(points, lines, surface)]
    .sort((a, b) => b.score - a.score)
    .filter((candidate, _index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.38 && other.score >= candidate.score) === -1)
    .slice(0, 8);
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical].slice(0, 160);
  const candidates = practicalCandidates(points, lines, surface);
  return { lines, candidates };
}
