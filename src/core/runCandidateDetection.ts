import type { EdgePoint } from "../edgeDetect";
import { detectArchitecturalCandidates, type Bounds, type Point } from "./architecturalDetector";

export function runCandidateDetection(edgePoints: EdgePoint[], bounds: Bounds, polygon?: Point[] | null) {
  return detectArchitecturalCandidates(edgePoints, {
    bounds,
    polygon: polygon && polygon.length >= 3 ? polygon : null,
    gridResolution: 120,
    minDensityThreshold: 1
  });
}
