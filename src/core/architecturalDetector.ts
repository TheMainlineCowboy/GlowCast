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

function slidingCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds): CandidateProposal[] {
  const out: CandidateProposal[] = [];
  const widths = [0.16, 0.19, 0.22, 0.25, 0.28].map((n) => surface.width * n);
  const heights = [0.16, 0.20, 0.24, 0.28, 0.32].map((n) => surface.height * n);
  const stepX = surface.width * 0.035;
  const stepY = surface.height * 0.04;
  const marginX = surface.width * 0.035;
  const marginY = surface.height * 0.035;
  let id = 0;

  for (const width of widths) {
    for (const height of heights) {
      for (let y = surface.y + marginY; y <= surface.y + surface.height - height - marginY; y += stepY) {
        for (let x = surface.x + marginX; x <= surface.x + surface.width - width - marginX; x += stepX) {
          const support = countPoints(points, x, y, width, height);
          const hLines = lineSupport(lines, x, y, width, height, "horizontal");
          const vLines = lineSupport(lines, x, y, width, height, "vertical");
          if (support.count < 7) continue;
          if (hLines < 1 || vLines < 1) continue;
          if (hLines + vLines < 4) continue;
          const aspect = width / height;
          if (aspect < 0.65 || aspect > 2.15) continue;
          const oversizePenalty = Math.max(0, width / surface.width - 0.24) * 90;
          const score = Math.round(support.count * 2.2 + hLines * 13 + vLines * 13 + Math.min(20, support.strength / 900) - oversizePenalty);
          if (score < 46) continue;
          out.push({
            id: `slide-${id++}`,
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2)),
            score,
            contributingLines: hLines + vLines,
            status: score >= 70 ? "high" : "low"
          });
        }
      }
    }
  }

  return out
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.30 && other.score >= candidate.score) === -1)
    .slice(0, 8);
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical].slice(0, 160);
  return { lines, candidates: slidingCandidates(points, lines, surface) };
}
