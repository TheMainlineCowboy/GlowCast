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

function mergeBoxes(a: SimpleBox, b: SimpleBox): SimpleBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: maxX - x, height: maxY - y };
}

function gapBetween(a: SimpleBox, b: SimpleBox): { x: number; y: number } {
  return {
    x: Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width)),
    y: Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  };
}

function shouldAttachSatellite(parent: SimpleBox, satellite: SimpleBox, bounds: SimpleBox): boolean {
  const parentArea = parent.width * parent.height;
  const satelliteArea = satellite.width * satellite.height;
  if (satelliteArea >= parentArea * 0.9) return false;

  const gap = gapBetween(parent, satellite);
  const verticalOverlap = Math.max(
    0,
    Math.min(parent.y + parent.height, satellite.y + satellite.height) - Math.max(parent.y, satellite.y)
  );
  const horizontalOverlap = Math.max(
    0,
    Math.min(parent.x + parent.width, satellite.x + satellite.width) - Math.max(parent.x, satellite.x)
  );
  const verticalAlignment = verticalOverlap / Math.max(Math.min(parent.height, satellite.height), 1);
  const horizontalAlignment = horizontalOverlap / Math.max(Math.min(parent.width, satellite.width), 1);

  const sideBySideTrim =
    gap.x <= Math.max(2.5, bounds.width * 0.045) &&
    gap.y <= Math.max(1.2, bounds.height * 0.02) &&
    verticalAlignment >= 0.52 &&
    satellite.height >= parent.height * 0.45;

  const stackedTrim =
    gap.y <= Math.max(2.5, bounds.height * 0.045) &&
    gap.x <= Math.max(1.2, bounds.width * 0.02) &&
    horizontalAlignment >= 0.52 &&
    satellite.width >= parent.width * 0.45;

  if (!sideBySideTrim && !stackedTrim) return false;

  const combined = mergeBoxes(parent, satellite);
  const combinedArea = combined.width * combined.height;
  const boundsArea = bounds.width * bounds.height;
  const aspect = combined.width / Math.max(combined.height, 0.01);

  return combinedArea <= boundsArea * 0.42 && aspect >= 0.18 && aspect <= 5.2;
}

function groupNearbySatellites(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < grouped.length; i += 1) {
      for (let j = 0; j < grouped.length; j += 1) {
        if (i === j) continue;

        const parent = grouped[i];
        const satellite = grouped[j];
        if (!shouldAttachSatellite(parent.box, satellite.box, bounds)) continue;

        const mergedBox = mergeBoxes(parent.box, satellite.box);
        grouped[i] = {
          ...parent,
          box: mergedBox,
          points: boxPoints(mergedBox)
        };
        grouped.splice(j, 1);
        changed = true;
        break;
      }

      if (changed) break;
    }
  }

  return grouped;
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

  return groupNearbySatellites(accepted, bounds).slice(0, 10);
}
