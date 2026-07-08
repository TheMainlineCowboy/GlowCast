import type { EdgePoint } from "../edgeDetect";
import { detectArchitecturalCandidates } from "./architecturalDetector";

export type SimplePoint = { x: number; y: number };
export type SimpleBox = { x: number; y: number; width: number; height: number };

export type MaskCandidateOutput = {
  id: string;
  box: SimpleBox;
  points: SimplePoint[];
};

function boxPoints(box: SimpleBox): SimplePoint[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
}

function getAdapterDetectorLimits(bounds: SimpleBox) {
  const shortestSide = Math.min(bounds.width, bounds.height);
  const longestSide = Math.max(bounds.width, bounds.height);

  return {
    // The raw detector default is intentionally permissive. The adapter is the
    // user-facing auto-mask path, so it should suppress tiny trim/noise fragments
    // unless they are large enough to plausibly be a window, door, arch, or fixture.
    minSizePercent: Math.max(3.5, shortestSide * 0.075),
    maxSizePercent: Math.min(72, Math.max(38, longestSide * 0.72)),
    minDensityThreshold: 1
  };
}

function overlapRatio(a: SimpleBox, b: SimpleBox): number {
  const interX1 = Math.max(a.x, b.x);
  const interY1 = Math.max(a.y, b.y);
  const interX2 = Math.min(a.x + a.width, b.x + b.width);
  const interY2 = Math.min(a.y + a.height, b.y + b.height);

  if (interX2 <= interX1 || interY2 <= interY1) return 0;

  const interArea = (interX2 - interX1) * (interY2 - interY1);
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return interArea / Math.max(smallerArea, 1);
}

export function buildMaskCandidatesFromEdges(edgePoints: EdgePoint[], bounds: SimpleBox): MaskCandidateOutput[] {
  const limits = getAdapterDetectorLimits(bounds);
  const found = detectArchitecturalCandidates(edgePoints, { bounds, ...limits });
  const accepted: MaskCandidateOutput[] = [];

  for (const item of found) {
    const box = {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height
    };
    const points = item.points && item.points.length >= 3 ? item.points : boxPoints(box);

    const duplicate = accepted.some((existing) => overlapRatio(existing.box, box) > 0.74);
    if (duplicate) continue;

    accepted.push({
      id: "mask_candidate_" + Date.now() + "_" + accepted.length,
      box,
      points
    });
  }

  return accepted.slice(0, 10);
}
