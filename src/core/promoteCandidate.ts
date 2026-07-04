export type CandidateLike = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
  label?: string;
};

export function promoteCandidateToZone<T extends CandidateLike>(candidate: T, id: number) {
  return {
    id,
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    shape: candidate.shape ?? "rectangle",
    included: true,
    label: candidate.label ?? "approved edge mask"
  };
}
