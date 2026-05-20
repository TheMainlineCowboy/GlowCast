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

function perimeterSupport(points: EdgePoint[], x: number, y: number, width: number, height: number) {
  const band = Math.max(1.2, Math.min(width, height) * 0.16);
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
  const innerX = x + width * 0.18;
  const innerY = y + height * 0.18;
  const innerW = width * 0.64;
  const innerH = height * 0.64;
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

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function pointsInside(points: EdgePoint[], candidate: CandidateProposal) {
  return points.filter((point) => point.x >= candidate.x && point.x <= candidate.x + candidate.width && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
}

function refineToEdgeCluster(candidate: CandidateProposal, points: EdgePoint[], lines: LineSegment[], surface: Bounds, mode: "rect" | "arch"): CandidateProposal | null {
  const inside = pointsInside(points, candidate);
  if (inside.length < (mode === "arch" ? 6 : 8)) return null;

  const strengths = inside.map((point) => point.strength).sort((a, b) => a - b);
  const strengthCutoff = strengths[Math.floor(strengths.length * 0.42)] ?? 0;
  const strong = inside.filter((point) => point.strength >= strengthCutoff);
  if (strong.length < (mode === "arch" ? 5 : 7)) return null;

  const xs = strong.map((point) => point.x);
  const ys = strong.map((point) => point.y);
  const pad = Math.max(0.85, Math.min(candidate.width, candidate.height) * (mode === "arch" ? 0.16 : 0.12));
  let x1 = quantile(xs, 0.08) - pad;
  let x2 = quantile(xs, 0.92) + pad;
  let y1 = quantile(ys, 0.08) - pad;
  let y2 = quantile(ys, 0.92) + pad;

  x1 = Math.max(surface.x, Math.min(surface.x + surface.width, x1));
  x2 = Math.max(surface.x, Math.min(surface.x + surface.width, x2));
  y1 = Math.max(surface.y, Math.min(surface.y + surface.height, y1));
  y2 = Math.max(surface.y, Math.min(surface.y + surface.height, y2));

  const width = x2 - x1;
  const height = y2 - y1;
  if (width < surface.width * (mode === "arch" ? 0.14 : 0.11)) return null;
  if (height < surface.height * (mode === "arch" ? 0.10 : 0.13)) return null;
  if (width > surface.width * (mode === "arch" ? 0.38 : 0.24)) return null;
  if (height > surface.height * (mode === "arch" ? 0.28 : 0.34)) return null;

  const moved = Math.hypot((x1 + width / 2) - (candidate.x + candidate.width / 2), (y1 + height / 2) - (candidate.y + candidate.height / 2));
  if (moved > Math.max(candidate.width, candidate.height) * 0.42) return null;

  const refinedPoints = countPoints(points, x1, y1, width, height);
  const border = perimeterSupport(points, x1, y1, width, height);
  const interior = interiorStructure(points, x1, y1, width, height);
  const hLines = lineSupport(lines, x1, y1, width, height, "horizontal");
  const vLines = lineSupport(lines, x1, y1, width, height, "vertical");
  const aspect = width / Math.max(0.001, height);

  if (mode === "rect") {
    if (aspect < 0.58 || aspect > 1.65) return null;
    if (border.count < 6 || border.sides < 2) return null;
    if (interior.count < 4 || interior.xBands < 2 || interior.yBands < 2 || interior.quadrants < 2) return null;
    if (hLines < 1 || vLines < 1 || hLines + vLines < 4) return null;
  } else {
    if (aspect < 1.05 || aspect > 3.20) return null;
    if (interior.count < 2 || interior.xBands < 2) return null;
    if (hLines < 1 || vLines < 1) return null;
  }

  const specklePenalty = Math.max(0, refinedPoints.count - border.count - interior.count) * (mode === "arch" ? 1.1 : 1.8);
  const score = Math.round(border.count * 2.5 + interior.count * 3.2 + hLines * 13 + vLines * 13 + Math.min(20, refinedPoints.strength / 900) - specklePenalty);
  if (score < (mode === "arch" ? 42 : 48)) return null;

  return {
    ...candidate,
    x: Number(x1.toFixed(2)),
    y: Number(y1.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    score: Math.max(candidate.score, score),
    contributingLines: hLines + vLines,
    status: score >= 70 ? "high" : "low"
  };
}

function slidingCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds): CandidateProposal[] {
  const out: CandidateProposal[] = [];
  const widths = [0.15, 0.17, 0.19, 0.21, 0.23].map((n) => surface.width * n);
  const heights = [0.18, 0.21, 0.24, 0.27, 0.30].map((n) => surface.height * n);
  const stepX = surface.width * 0.025;
  const stepY = surface.height * 0.035;
  const marginX = surface.width * 0.035;
  const marginY = surface.height * 0.22;
  let id = 0;

  for (const width of widths) {
    for (const height of heights) {
      for (let y = surface.y + marginY; y <= surface.y + surface.height - height - surface.height * 0.10; y += stepY) {
        for (let x = surface.x + marginX; x <= surface.x + surface.width - width - marginX; x += stepX) {
          const support = countPoints(points, x, y, width, height);
          const border = perimeterSupport(points, x, y, width, height);
          const interior = interiorStructure(points, x, y, width, height);
          const hLines = lineSupport(lines, x, y, width, height, "horizontal");
          const vLines = lineSupport(lines, x, y, width, height, "vertical");
          if (support.count < 7) continue;
          if (border.count < 6 || border.sides < 2) continue;
          if (interior.count < 4 || interior.xBands < 2 || interior.yBands < 2 || interior.quadrants < 2) continue;
          if (hLines < 1 || vLines < 1) continue;
          if (hLines + vLines < 4) continue;
          const aspect = width / height;
          if (aspect < 0.65 || aspect > 1.75) continue;
          const oversizePenalty = Math.max(0, width / surface.width - 0.20) * 140;
          const wallSpecklePenalty = Math.max(0, support.count - border.count - interior.count) * 1.8;
          const score = Math.round(border.count * 2.4 + interior.count * 3 + hLines * 13 + vLines * 13 + Math.min(20, support.strength / 900) - oversizePenalty - wallSpecklePenalty);
          if (score < 48) continue;
          const raw = {
            id: `slide-${id++}`,
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2)),
            score,
            contributingLines: hLines + vLines,
            status: score >= 70 ? "high" : "low" as "high" | "low"
          };
          const refined = refineToEdgeCluster(raw, points, lines, surface, "rect");
          if (refined) out.push(refined);
        }
      }
    }
  }

  return out;
}

function archCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds, rectangles: CandidateProposal[]): CandidateProposal[] {
  const paired = rectangles
    .filter((candidate) => candidate.y > surface.y + surface.height * 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.x - b.x);
  if (paired.length < 2) return [];

  let bestPair: [CandidateProposal, CandidateProposal] | null = null;
  for (let i = 0; i < paired.length; i++) {
    for (let j = i + 1; j < paired.length; j++) {
      const a = paired[i];
      const b = paired[j];
      const similarY = Math.abs(a.y - b.y) <= surface.height * 0.09;
      const similarH = Math.abs(a.height - b.height) <= surface.height * 0.08;
      const separated = b.x - (a.x + a.width) >= surface.width * 0.06;
      if (similarY && similarH && separated) bestPair = [a, b];
    }
  }
  if (!bestPair) return [];

  const [left, right] = bestPair;
  const pairLeft = left.x;
  const pairRight = right.x + right.width;
  const pairCenter = (pairLeft + pairRight) / 2;
  const width = Math.min(surface.width * 0.34, Math.max(surface.width * 0.22, pairRight - pairLeft));
  const height = Math.min(surface.height * 0.24, Math.max(surface.height * 0.16, left.height * 0.72));
  const x = pairCenter - width / 2;
  const y = Math.max(surface.y + surface.height * 0.08, left.y - height - surface.height * 0.07);

  const support = countPoints(points, x, y, width, height);
  const interior = interiorStructure(points, x, y, width, height);
  const hLines = lineSupport(lines, x, y, width, height, "horizontal");
  const vLines = lineSupport(lines, x, y, width, height, "vertical");
  if (support.count < 6 || interior.count < 2 || hLines < 1 || vLines < 1) return [];

  const raw = {
    id: "arch-centered-0",
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    score: Math.round(support.count * 2.2 + interior.count * 3 + hLines * 10 + vLines * 9),
    contributingLines: hLines + vLines,
    status: "high" as "high" | "low"
  };
  const refined = refineToEdgeCluster(raw, points, lines, surface, "arch");
  return refined ? [refined] : [];
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const surface = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical].slice(0, 160);
  const rectangles = slidingCandidates(points, lines, surface)
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.28 && other.score >= candidate.score) === -1)
    .slice(0, 4);
  const candidates = [...rectangles, ...archCandidates(points, lines, surface, rectangles)]
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.22 && other.score >= candidate.score) === -1)
    .slice(0, 5);
  return { lines, candidates };
}
