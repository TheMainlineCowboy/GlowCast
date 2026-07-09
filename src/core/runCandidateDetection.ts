import type { EdgePoint } from "../edgeDetect";
import type { Bounds, CandidateZone, Point } from "./architecturalDetector";
import { buildMaskCandidatesFromEdges, type SimpleBox } from "./maskCandidateAdapter";

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function scopedEdgePoints(edgePoints: EdgePoint[], polygon?: Point[] | null): EdgePoint[] {
  if (!polygon || polygon.length < 3) return edgePoints;
  return edgePoints.filter((point) => pointInPolygon(point, polygon));
}

function pointToLocalPercent(point: Point, box: SimpleBox): Point {
  return {
    x: Number((((point.x - box.x) / Math.max(box.width, 0.01)) * 100).toFixed(2)),
    y: Number((((point.y - box.y) / Math.max(box.height, 0.01)) * 100).toFixed(2))
  };
}

function looksArchLike(points: Point[] | undefined, box: SimpleBox): boolean {
  if (!points || points.length < 5) return false;

  const centerMin = box.x + box.width * 0.28;
  const centerMax = box.x + box.width * 0.72;
  const sideBand = Math.max(1.2, box.width * 0.12);
  const lowerHalf = box.y + box.height * 0.42;
  const bottomBand = box.y + box.height * 0.78;
  const topBand = box.y + box.height * 0.24;

  const topCenter = points.some((point) => point.x >= centerMin && point.x <= centerMax && point.y <= topBand);
  const leftSide = points.some((point) => point.x <= box.x + sideBand && point.y >= lowerHalf);
  const rightSide = points.some((point) => point.x >= box.x + box.width - sideBand && point.y >= lowerHalf);
  const bottomSpan = points.filter((point) => point.y >= bottomBand).length >= 2;

  return topCenter && leftSide && rightSide && bottomSpan;
}

function classifyCandidate(mask: { box: SimpleBox; points: Point[] }, index: number): { shape: CandidateZone["shape"]; label: string; confidence: number } {
  const aspect = mask.box.width / Math.max(mask.box.height, 0.01);
  const hasCustomOutline = mask.points.length > 4;
  const isArch = looksArchLike(mask.points, mask.box);

  if (isArch) {
    return {
      shape: "freehand",
      confidence: Math.max(76, 90 - index * 3),
      label: `Auto arch mask ${index + 1}`
    };
  }

  if (aspect >= 0.28 && aspect <= 0.68) {
    return {
      shape: hasCustomOutline ? "freehand" : "rectangle",
      confidence: Math.max(72, 88 - index * 3),
      label: `Auto door mask ${index + 1}`
    };
  }

  if (aspect >= 0.68 && aspect <= 1.75) {
    return {
      shape: hasCustomOutline ? "freehand" : "rectangle",
      confidence: Math.max(70, 86 - index * 3),
      label: `Auto window mask ${index + 1}`
    };
  }

  return {
    shape: hasCustomOutline ? "freehand" : "rectangle",
    confidence: Math.max(68, 84 - index * 3),
    label: `Auto architectural mask ${index + 1}`
  };
}

function candidateFromMask(mask: { id: string; box: SimpleBox; points: Point[] }, index: number): CandidateZone {
  const points = mask.points.length >= 3 ? mask.points.map((point) => pointToLocalPercent(point, mask.box)) : undefined;
  const classified = classifyCandidate(mask, index);

  return {
    id: mask.id,
    x: Number(mask.box.x.toFixed(2)),
    y: Number(mask.box.y.toFixed(2)),
    width: Number(mask.box.width.toFixed(2)),
    height: Number(mask.box.height.toFixed(2)),
    shape: classified.shape,
    confidence: classified.confidence,
    label: classified.label,
    points
  };
}

export function runCandidateDetection(edgePoints: EdgePoint[], bounds: Bounds, polygon?: Point[] | null): CandidateZone[] {
  const scopedPoints = scopedEdgePoints(edgePoints, polygon);
  return buildMaskCandidatesFromEdges(scopedPoints, bounds).map(candidateFromMask);
}
