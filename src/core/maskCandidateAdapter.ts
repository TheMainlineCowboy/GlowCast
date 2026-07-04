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

export function buildMaskCandidatesFromEdges(edgePoints: EdgePoint[], bounds: SimpleBox): MaskCandidateOutput[] {
  const found = detectArchitecturalCandidates(edgePoints, { bounds });
  return found.map((item, index) => {
    const box = {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height
    };
    return {
      id: "mask_candidate_" + Date.now() + "_" + index,
      box,
      points: boxPoints(box)
    };
  });
}
