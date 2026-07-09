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

function candidateFromMask(mask: { id: string; box: SimpleBox; points: Point[] }, index: number): CandidateZone {
  return {
    id: mask.id,
    x: Number(mask.box.x.toFixed(2)),
    y: Number(mask.box.y.toFixed(2)),
    width: Number(mask.box.width.toFixed(2)),
    height: Number(mask.box.height.toFixed(2)),
    shape: mask.points.length > 4 ? "freehand" : "rectangle",
    confidence: Math.max(68, 86 - index * 3),
    label: `Auto architectural mask ${index + 1}`,
    points: mask.points.length >= 3 ? mask.points : undefined
  };
}

export function runCandidateDetection(edgePoints: EdgePoint[], bounds: Bounds, polygon?: Point[] | null): CandidateZone[] {
  const scopedPoints = scopedEdgePoints(edgePoints, polygon);
  return buildMaskCandidatesFromEdges(scopedPoints, bounds).map(candidateFromMask);
}
