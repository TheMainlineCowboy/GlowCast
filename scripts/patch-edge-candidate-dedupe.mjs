import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {");
const end = source.indexOf("\nfunction classifyBoxShape", start);

if (start === -1 || end === -1) {
  throw new Error("Edge candidate dedupe patch failed: mergeCandidateBoxes anchor not found.");
}

const replacement = `function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {
  const accepted: ComponentBox[] = [];

  const centerOf = (box: ProjectionZone) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  });

  const rank = (box: ComponentBox) => {
    const shapeBonus = box.detectedShape && box.detectedShape !== "rectangle" ? 1.5 : 0;
    const area = box.width * box.height;
    const tinyPenalty = area < 40 ? 1.2 : 0;
    return box.score + shapeBonus - tinyPenalty;
  };

  const sorted = [...boxes].sort((a, b) => rank(b) - rank(a));

  for (const candidate of sorted) {
    const candidateCenter = centerOf(candidate);
    const duplicate = accepted.some((existing) => {
      const existingCenter = centerOf(existing);
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      const overlapRatio = overlap / Math.max(minArea, 1);
      const dx = Math.abs(candidateCenter.x - existingCenter.x);
      const dy = Math.abs(candidateCenter.y - existingCenter.y);
      const centerDistance = Math.hypot(dx, dy);
      const sameNonRectFamily =
        candidate.detectedShape !== "rectangle" &&
        existing.detectedShape !== "rectangle" &&
        candidate.detectedShape === existing.detectedShape;
      const sameObjectCluster = sameNonRectFamily && dx < 22 && dy < 20;
      const closeCenters = centerDistance < Math.max(4.5, Math.min(existing.width + candidate.width, existing.height + candidate.height) * 0.42);
      const nearSameObject = closeCenters && overlapRatio > 0.06;
      return overlapRatio > 0.24 || nearSameObject || sameObjectCluster;
    });

    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 6) break;
  }

  return accepted;
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge candidate dedupe clusters duplicate shape masks by object center");
