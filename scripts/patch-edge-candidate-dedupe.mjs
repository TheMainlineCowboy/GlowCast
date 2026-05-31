import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {");
const end = source.indexOf("\nfunction classifyBoxShape", start);

if (start === -1 || end === -1) {
  throw new Error("Edge candidate dedupe patch failed: mergeCandidateBoxes anchor not found.");
}

const replacement = `function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {
  const centerOf = (box: ProjectionZone) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  });

  const rank = (box: ComponentBox) => {
    const shapeBonus = box.detectedShape === "triangle" ? 2.5 : box.detectedShape === "circle" || box.detectedShape === "oval" ? 1.5 : 0;
    return box.score + shapeBonus;
  };

  const chooseShape = (a?: DetectedMaskShape, b?: DetectedMaskShape): DetectedMaskShape => {
    if (a === "triangle" || b === "triangle") return "triangle";
    if (a === "circle" || b === "circle") return "circle";
    if (a === "oval" || b === "oval") return "oval";
    return "rectangle";
  };

  const accepted: ComponentBox[] = [];
  const sorted = [...boxes].sort((a, b) => rank(b) - rank(a));

  for (const candidate of sorted) {
    const c = centerOf(candidate);
    let mergedInto = -1;

    for (let i = 0; i < accepted.length; i += 1) {
      const existing = accepted[i];
      const e = centerOf(existing);
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      const overlapRatio = overlap / Math.max(minArea, 1);
      const dx = Math.abs(c.x - e.x);
      const dy = Math.abs(c.y - e.y);
      const closeSameObject = dx < Math.max(8, Math.max(existing.width, candidate.width) * 0.95) && dy < Math.max(7, Math.max(existing.height, candidate.height) * 1.25);
      const edgePartOfSameObject = overlapRatio > 0.05 || closeSameObject;
      if (!edgePartOfSameObject) continue;

      const x = Math.min(existing.x, candidate.x);
      const y = Math.min(existing.y, candidate.y);
      const maxX = Math.max(existing.x + existing.width, candidate.x + candidate.width);
      const maxY = Math.max(existing.y + existing.height, candidate.y + candidate.height);
      accepted[i] = {
        x,
        y,
        width: maxX - x,
        height: maxY - y,
        score: Math.max(existing.score, candidate.score) + 0.75,
        edgeCount: existing.edgeCount + candidate.edgeCount,
        cells: existing.cells + candidate.cells,
        detectedShape: chooseShape(existing.detectedShape, candidate.detectedShape)
      };
      mergedInto = i;
      break;
    }

    if (mergedInto === -1) accepted.push(candidate);
  }

  return accepted
    .filter((box) => box.width >= 5 && box.height >= 5)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 8);
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge outline fragments cluster into whole object mask candidates");
