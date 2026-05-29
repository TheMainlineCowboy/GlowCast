import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("function shouldMergePaneBoxes(");
const end = source.indexOf("export function generateAutoMasks(");
if (start === -1 || end === -1) throw new Error("Could not find edge cleanup replacement anchors.");

const replacement = `function shouldMergePaneBoxes(a: ProjectionZone, b: ProjectionZone, projectionZone: ProjectionZone) {
  const combined = mergeBoxes(a, b);
  const combinedArea = combined.width * combined.height;
  const projectionArea = projectionZone.width * projectionZone.height;
  const aspect = combined.width / Math.max(combined.height, 0.01);

  // Do not create one candidate that spans multiple obvious separate openings.
  if (combinedArea > projectionArea * 0.145) return false;
  if (combined.width > projectionZone.width * 0.34) return false;
  if (combined.height > projectionZone.height * 0.44) return false;
  if (aspect < 0.45 || aspect > 2.55) return false;

  const overlap = overlapAmount(a, b);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  if (overlap / Math.max(minArea, 1) > 0.34) return true;

  const { xGap, yGap } = gapBetween(a, b);
  const { xRatio, yRatio } = overlapRatios(a, b);
  const aCenterY = a.y + a.height / 2;
  const bCenterY = b.y + b.height / 2;
  const aCenterX = a.x + a.width / 2;
  const bCenterX = b.x + b.width / 2;
  const similarHeight = Math.min(a.height, b.height) / Math.max(a.height, b.height) >= 0.58;
  const similarWidth = Math.min(a.width, b.width) / Math.max(a.width, b.width) >= 0.52;

  // Pane fragments should be very close. Separate shape objects should not bridge into one wide mask.
  const horizontalNeighbors =
    xGap <= Math.max(0.65, projectionZone.width * 0.012) &&
    yRatio >= 0.70 &&
    similarHeight &&
    Math.abs(aCenterY - bCenterY) <= Math.max(a.height, b.height) * 0.24;

  const verticalNeighbors =
    yGap <= Math.max(0.75, projectionZone.height * 0.018) &&
    xRatio >= 0.66 &&
    similarWidth &&
    Math.abs(aCenterX - bCenterX) <= Math.max(a.width, b.width) * 0.28;

  return horizontalNeighbors || verticalNeighbors;
}

function mergeNearbyPaneBoxes(boxes: CellCandidate[], projectionZone: ProjectionZone): CellCandidate[] {
  const mergedBoxes = [...boxes];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < mergedBoxes.length; i += 1) {
      for (let j = i + 1; j < mergedBoxes.length; j += 1) {
        if (!shouldMergePaneBoxes(mergedBoxes[i], mergedBoxes[j], projectionZone)) continue;
        const first = mergedBoxes[i];
        const second = mergedBoxes[j];
        const combined = mergeBoxes(first, second);
        mergedBoxes[i] = {
          ...combined,
          score: Math.max(first.score, second.score) + 0.16,
          edgeCount: first.edgeCount + second.edgeCount
        };
        mergedBoxes.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return mergedBoxes;
}

function buildWindowCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): CellCandidate[] {
  const points = edgePoints.filter((point) => pointInsideBox(point, projectionZone));
  const candidates: CellCandidate[] = [];
  const minW = Math.max(5, projectionZone.width * 0.1);
  const maxW = Math.max(minW + 1, projectionZone.width * 0.34);
  const minH = Math.max(6, projectionZone.height * 0.16);
  const maxH = Math.max(minH + 1, projectionZone.height * 0.38);
  const stepX = Math.max(1.25, projectionZone.width / 42);
  const stepY = Math.max(1.25, projectionZone.height / 42);
  const widths = [minW, (minW + maxW) / 2, maxW];
  const heights = [minH, (minH + maxH) / 2, maxH];

  for (const width of widths) {
    for (const height of heights) {
      for (let y = projectionZone.y; y <= projectionZone.y + projectionZone.height - height; y += stepY) {
        for (let x = projectionZone.x; x <= projectionZone.x + projectionZone.width - width; x += stepX) {
          const scored = scoreBox(points, { x, y, width, height }, projectionZone);
          if (scored) candidates.push(scored);
        }
      }
    }
  }

  const accepted: CellCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const aspect = candidate.width / Math.max(candidate.height, 0.01);
    if (aspect < 0.48 || aspect > 2.55) continue;
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.44;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 18) break;
  }

  const merged = mergeNearbyPaneBoxes(accepted, projectionZone);
  const sorted = merged
    .filter((box) => {
      const aspect = box.width / Math.max(box.height, 0.01);
      const area = box.width * box.height;
      const projectionArea = projectionZone.width * projectionZone.height;
      const giantMixedStrip = box.width > projectionZone.width * 0.34 && box.height < projectionZone.height * 0.34;
      const skinny = box.width < projectionZone.width * 0.085 || box.height < projectionZone.height * 0.135;
      return area <= projectionArea * 0.155 && aspect >= 0.48 && aspect <= 2.55 && !giantMixedStrip && !skinny;
    })
    .sort((a, b) => (b.width * b.height) - (a.width * a.height) || b.score - a.score);

  const cleaned: CellCandidate[] = [];
  for (const candidate of sorted) {
    const candidateArea = candidate.width * candidate.height;
    const duplicateOrFragment = cleaned.some((existing) => {
      const existingArea = existing.width * existing.height;
      const overlap = overlapAmount(existing, candidate);
      const overlapCandidate = overlap / Math.max(candidateArea, 1);
      const overlapExisting = overlap / Math.max(existingArea, 1);
      const closeCenters =
        Math.abs((existing.x + existing.width / 2) - (candidate.x + candidate.width / 2)) < projectionZone.width * 0.045 &&
        Math.abs((existing.y + existing.height / 2) - (candidate.y + candidate.height / 2)) < projectionZone.height * 0.045;
      return overlapCandidate > 0.36 || overlapExisting > 0.74 || closeCenters;
    });
    if (!duplicateOrFragment) cleaned.push(candidate);
    if (cleaned.length >= 4) break;
  }

  return cleaned.sort((a, b) => b.score - a.score).slice(0, 4);
}

`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
