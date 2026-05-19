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

type DetectorOptions = {
  bounds?: Bounds | null;
  polygon?: Point[] | null;
  maxLines?: number;
};

function insidePolygon(point: { x: number; y: number }, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function scopedPoints(edgePoints: EdgePoint[], options: DetectorOptions) {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const polygon = options.polygon && options.polygon.length >= 3 ? options.polygon : null;
  return edgePoints.filter((point) => {
    const inBounds = point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
    return inBounds && (!polygon || insidePolygon(point, polygon));
  });
}

function buildLineSegments(points: EdgePoint[], orientation: StructuralOrientation, options: DetectorOptions): LineSegment[] {
  if (!points.length) return [];
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const minLength = Math.max(5.5, (orientation === "horizontal" ? bounds.width : bounds.height) * 0.09);
  const binSize = 1.15;
  const runGap = 2.15;
  const bins = new Map<number, EdgePoint[]>();

  for (const point of points) {
    const key = Math.round((orientation === "horizontal" ? point.y : point.x) / binSize);
    const list = bins.get(key) ?? [];
    list.push(point);
    bins.set(key, list);
  }

  const lines: LineSegment[] = [];
  for (const [key, binPoints] of bins) {
    const sorted = [...binPoints].sort((a, b) => (orientation === "horizontal" ? a.x - b.x : a.y - b.y));
    let run: EdgePoint[] = [];

    const flush = () => {
      if (run.length < 5) {
        run = [];
        return;
      }
      const xs = run.map((point) => point.x);
      const ys = run.map((point) => point.y);
      const x1 = Math.min(...xs);
      const x2 = Math.max(...xs);
      const y1 = Math.min(...ys);
      const y2 = Math.max(...ys);
      const length = orientation === "horizontal" ? x2 - x1 : y2 - y1;
      if (length < minLength) {
        run = [];
        return;
      }
      const averageStrength = run.reduce((sum, point) => sum + point.strength, 0) / run.length;
      const center = key * binSize;
      lines.push({
        id: `${orientation}-${key}-${lines.length}`,
        orientation,
        x1: orientation === "horizontal" ? x1 : center,
        y1: orientation === "horizontal" ? center : y1,
        x2: orientation === "horizontal" ? x2 : center,
        y2: orientation === "horizontal" ? center : y2,
        length,
        strength: averageStrength
      });
      run = [];
    };

    for (const point of sorted) {
      if (!run.length) {
        run.push(point);
        continue;
      }
      const previous = run[run.length - 1];
      const gap = orientation === "horizontal" ? point.x - previous.x : point.y - previous.y;
      if (gap <= runGap) run.push(point);
      else {
        flush();
        run.push(point);
      }
    }
    flush();
  }

  return lines.sort((a, b) => b.length * b.strength - a.length * a.strength).slice(0, options.maxLines ?? 80);
}

function lineNearHorizontal(line: LineSegment, x1: number, x2: number, tolerance = 2.3) {
  if (line.orientation !== "horizontal") return false;
  return line.x1 <= x1 + tolerance && line.x2 >= x2 - tolerance;
}

function lineNearVertical(line: LineSegment, y1: number, y2: number, tolerance = 2.3) {
  if (line.orientation !== "vertical") return false;
  return line.y1 <= y1 + tolerance && line.y2 >= y2 - tolerance;
}

function scoreCandidate(bounds: Bounds, lines: LineSegment[], surfaceBounds: Bounds): CandidateProposal | null {
  const area = bounds.width * bounds.height;
  const surfaceArea = Math.max(1, surfaceBounds.width * surfaceBounds.height);
  const aspect = bounds.width / Math.max(0.01, bounds.height);
  if (area < surfaceArea * 0.012 || area > surfaceArea * 0.32) return null;
  if (bounds.width < 7 || bounds.height < 7) return null;
  if (aspect < 0.35 || aspect > 3.8) return null;

  const top = lines.find((line) => Math.abs(line.y1 - bounds.y) < 2.5 && lineNearHorizontal(line, bounds.x, bounds.x + bounds.width));
  const bottom = lines.find((line) => Math.abs(line.y1 - (bounds.y + bounds.height)) < 2.5 && lineNearHorizontal(line, bounds.x, bounds.x + bounds.width));
  const left = lines.find((line) => Math.abs(line.x1 - bounds.x) < 2.5 && lineNearVertical(line, bounds.y, bounds.y + bounds.height));
  const right = lines.find((line) => Math.abs(line.x1 - (bounds.x + bounds.width)) < 2.5 && lineNearVertical(line, bounds.y, bounds.y + bounds.height));
  const contributingLines = [top, bottom, left, right].filter(Boolean).length;
  if (contributingLines < 2) return null;

  let score = contributingLines * 18;
  if (contributingLines >= 3) score += 20;
  if (aspect >= 0.65 && aspect <= 2.4) score += 18;
  if (area >= surfaceArea * 0.025 && area <= surfaceArea * 0.18) score += 14;

  return {
    id: `arch-${Math.round(bounds.x * 10)}-${Math.round(bounds.y * 10)}-${Math.round(bounds.width * 10)}-${Math.round(bounds.height * 10)}`,
    x: Number(bounds.x.toFixed(2)),
    y: Number(bounds.y.toFixed(2)),
    width: Number(bounds.width.toFixed(2)),
    height: Number(bounds.height.toFixed(2)),
    score: Math.min(99, Math.round(score)),
    contributingLines,
    status: score >= 70 ? "high" : "low"
  };
}

function overlapRatio(a: CandidateProposal, b: CandidateProposal) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

export function detectArchitecturalCandidates(edgePoints: EdgePoint[], options: DetectorOptions = {}): ArchitecturalDetectionResult {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  const points = scopedPoints(edgePoints, options);
  const horizontal = buildLineSegments(points, "horizontal", options);
  const vertical = buildLineSegments(points, "vertical", options);
  const lines = [...horizontal, ...vertical];
  const proposals: CandidateProposal[] = [];

  for (const top of horizontal) {
    for (const bottom of horizontal) {
      if (bottom.y1 <= top.y1 + 5) continue;
      const y = top.y1;
      const height = bottom.y1 - top.y1;
      if (height < 7 || height > bounds.height * 0.75) continue;
      for (const left of vertical) {
        if (!lineNearVertical(left, y, y + height, 4.2)) continue;
        for (const right of vertical) {
          if (right.x1 <= left.x1 + 7) continue;
          if (!lineNearVertical(right, y, y + height, 4.2)) continue;
          const x = left.x1;
          const width = right.x1 - left.x1;
          const candidate = scoreCandidate({ x, y, width, height }, lines, bounds);
          if (candidate) proposals.push(candidate);
        }
      }
    }
  }

  const candidates = proposals
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlapRatio(other, candidate) > 0.68 && other.score >= candidate.score) === -1)
    .slice(0, 16);

  return { lines: lines.slice(0, 120), candidates };
}
