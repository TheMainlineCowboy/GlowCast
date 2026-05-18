import type { EdgePoint } from "../edgeDetect";
import { buildEdgePaths, isMostlyClosed, pathBounds, polygonArea, type EdgePath } from "./edgePaths";

export type EdgeMaskCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  points?: { x: number; y: number }[];
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function candidateFromPath(path: EdgePath): EdgeMaskCandidate | null {
  if (path.length < 4) return null;
  const bounds = pathBounds(path);
  const area = bounds.width * bounds.height;
  const polyArea = polygonArea(path);
  const closed = isMostlyClosed(path);
  const usableSize = bounds.width >= 2.5 && bounds.height >= 2.5 && area >= 12 && area <= 2200;
  const areaFill = area > 0 ? polyArea / area : 0;

  if (!usableSize) return null;
  if (!closed && path.length < 8) return null;
  if (!closed && areaFill < 0.08) return null;

  const confidence = Math.min(0.99, (closed ? 0.55 : 0.25) + Math.min(0.35, areaFill) + Math.min(0.2, path.length / 80));
  return {
    x: Number(clamp(bounds.x).toFixed(2)),
    y: Number(clamp(bounds.y).toFixed(2)),
    width: Number(clamp(bounds.width, 0, 100 - bounds.x).toFixed(2)),
    height: Number(clamp(bounds.height, 0, 100 - bounds.y).toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    points: path.map((point) => ({ x: Number(clamp(point.x).toFixed(2)), y: Number(clamp(point.y).toFixed(2)) }))
  };
}

function overlaps(a: EdgeMaskCandidate, b: EdgeMaskCandidate) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 && (ix * iy) / smaller > 0.6;
}

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 16): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  const paths = buildEdgePaths(edgePoints);
  const candidates = paths
    .map(candidateFromPath)
    .filter((candidate): candidate is EdgeMaskCandidate => Boolean(candidate))
    .sort((a, b) => b.confidence - a.confidence);

  const unique: EdgeMaskCandidate[] = [];
  for (const candidate of candidates) {
    if (unique.some((existing) => overlaps(existing, candidate))) continue;
    unique.push(candidate);
    if (unique.length >= limit) break;
  }
  return unique;
}
