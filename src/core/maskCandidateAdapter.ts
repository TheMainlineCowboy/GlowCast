import type { EdgePoint } from "../edgeDetect";
import { detectArchitecturalCandidates } from "./architecturalDetector";

export type SimplePoint = { x: number; y: number };
export type SimpleBox = { x: number; y: number; width: number; height: number };

export type MaskCandidateOutput = {
  id: string;
  box: SimpleBox;
  points: SimplePoint[];
};

type FallbackComponent = SimpleBox & { cells: number; edgeCount: number; score: number };

type SideCoverage = {
  sides: number;
  hasHorizontal: boolean;
  hasVertical: boolean;
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

function clampBox(box: SimpleBox, bounds: SimpleBox): SimpleBox {
  const x = Math.max(bounds.x, box.x);
  const y = Math.max(bounds.y, box.y);
  const maxX = Math.min(bounds.x + bounds.width, box.x + box.width);
  const maxY = Math.min(bounds.y + bounds.height, box.y + box.height);
  return { x, y, width: Math.max(0, maxX - x), height: Math.max(0, maxY - y) };
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

function getFallbackSideCoverage(points: EdgePoint[], box: SimpleBox): SideCoverage {
  const tolerance = Math.max(1.2, Math.min(box.width, box.height) * 0.09);
  const minHits = Math.max(3, Math.ceil(points.length * 0.055));
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;

  for (const point of points) {
    if (point.x < box.x - tolerance || point.x > box.x + box.width + tolerance) continue;
    if (point.y < box.y - tolerance || point.y > box.y + box.height + tolerance) continue;

    if (Math.abs(point.y - box.y) <= tolerance) top += 1;
    if (Math.abs(point.y - (box.y + box.height)) <= tolerance) bottom += 1;
    if (Math.abs(point.x - box.x) <= tolerance) left += 1;
    if (Math.abs(point.x - (box.x + box.width)) <= tolerance) right += 1;
  }

  const topPresent = top >= minHits;
  const bottomPresent = bottom >= minHits;
  const leftPresent = left >= minHits;
  const rightPresent = right >= minHits;

  return {
    sides: [topPresent, bottomPresent, leftPresent, rightPresent].filter(Boolean).length,
    hasHorizontal: topPresent || bottomPresent,
    hasVertical: leftPresent || rightPresent
  };
}

function buildFallbackComponents(edgePoints: EdgePoint[], bounds: SimpleBox): FallbackComponent[] {
  const strongPoints = edgePoints.filter(
    (point) =>
      point.strength >= 86 &&
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
  );
  if (!strongPoints.length) return [];

  const cellSize = Math.max(0.45, Math.min(bounds.width, bounds.height) / 90);
  const grid = new Map<string, { x: number; y: number; edgeCount: number; points: EdgePoint[] }>();

  for (const point of strongPoints) {
    const x = Math.floor((point.x - bounds.x) / cellSize);
    const y = Math.floor((point.y - bounds.y) / cellSize);
    const key = `${x},${y}`;
    const cell = grid.get(key);
    if (cell) {
      cell.edgeCount += 1;
      cell.points.push(point);
    } else {
      grid.set(key, { x, y, edgeCount: 1, points: [point] });
    }
  }

  const visited = new Set<string>();
  const components: FallbackComponent[] = [];
  const offsets = [-1, 0, 1];

  for (const [key, first] of grid) {
    if (visited.has(key)) continue;

    const queue = [first];
    const componentPoints: EdgePoint[] = [];
    visited.add(key);
    let minX = first.x;
    let maxX = first.x;
    let minY = first.y;
    let maxY = first.y;
    let cells = 0;
    let edgeCount = 0;

    while (queue.length) {
      const cell = queue.pop()!;
      componentPoints.push(...cell.points);
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
      maxY = Math.max(maxY, cell.y);
      cells += 1;
      edgeCount += cell.edgeCount;

      for (const dx of offsets) {
        for (const dy of offsets) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = `${cell.x + dx},${cell.y + dy}`;
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    const box = clampBox(
      {
        x: bounds.x + minX * cellSize,
        y: bounds.y + minY * cellSize,
        width: (maxX - minX + 1) * cellSize,
        height: (maxY - minY + 1) * cellSize
      },
      bounds
    );
    const area = box.width * box.height;
    const boundsArea = bounds.width * bounds.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    const sideCoverage = getFallbackSideCoverage(componentPoints, box);

    if (cells < 14 || edgeCount < 24) continue;
    if (box.width < Math.max(6, bounds.width * 0.075) || box.height < Math.max(6, bounds.height * 0.075)) continue;
    if (area < boundsArea * 0.01 || area > boundsArea * 0.34) continue;
    if (aspect < 0.18 || aspect > 5.4) continue;
    if (sideCoverage.sides < 2 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;

    components.push({
      ...box,
      cells,
      edgeCount,
      score: edgeCount / Math.max(area, 1) + cells * 0.02 + sideCoverage.sides * 0.3
    });
  }

  return components.sort((a, b) => b.score - a.score).slice(0, 8);
}

function addFallbackCandidates(
  accepted: MaskCandidateOutput[],
  edgePoints: EdgePoint[],
  bounds: SimpleBox
): MaskCandidateOutput[] {
  const next = [...accepted];

  for (const fallback of buildFallbackComponents(edgePoints, bounds)) {
    const box = { x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height };
    const duplicate = next.some((existing) => overlapRatio(existing.box, box) > 0.58);
    if (duplicate) continue;

    next.push({
      id: "mask_fallback_" + Date.now() + "_" + next.length,
      box,
      points: boxPoints(box)
    });
  }

  return next;
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

  return groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds).slice(0, 10);
}
