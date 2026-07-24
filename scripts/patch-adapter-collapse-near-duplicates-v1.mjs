import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "function suppressGroupedDuplicates(candidates: MaskCandidateOutput[]): MaskCandidateOutput[] {";
const start = source.indexOf(marker);
const end = start >= 0 ? source.indexOf("\nfunction ", start + marker.length) : -1;

if (start < 0 || end < 0) {
  throw new Error("Unable to isolate grouped duplicate suppression function after source preparation.");
}

const replacement = `function suppressGroupedDuplicates(candidates: MaskCandidateOutput[]): MaskCandidateOutput[] {
  const area = (candidate: MaskCandidateOutput) => candidate.box.width * candidate.box.height;
  const center = (candidate: MaskCandidateOutput) => ({
    x: candidate.box.x + candidate.box.width / 2,
    y: candidate.box.y + candidate.box.height / 2
  });

  const ranked = [...candidates].sort((a, b) => {
    const areaDelta = area(b) - area(a);
    if (Math.abs(areaDelta) > 0.01) return areaDelta;
    const pointDelta = a.points.length - b.points.length;
    if (pointDelta !== 0) return pointDelta;
    return a.id.localeCompare(b.id);
  });
  const kept: MaskCandidateOutput[] = [];

  for (const candidate of ranked) {
    const candidateArea = area(candidate);
    const candidateCenter = center(candidate);
    const duplicatesExisting = kept.some((existing) => {
      const existingArea = area(existing);
      const existingCenter = center(existing);
      const overlap = overlapRatio(existing.box, candidate.box);
      const widthRatio = candidate.box.width / Math.max(existing.box.width, 0.01);
      const heightRatio = candidate.box.height / Math.max(existing.box.height, 0.01);
      const sizeSimilar =
        widthRatio >= 0.72 && widthRatio <= 1.38 &&
        heightRatio >= 0.72 && heightRatio <= 1.38;
      const centerDistance = Math.hypot(
        candidateCenter.x - existingCenter.x,
        candidateCenter.y - existingCenter.y
      );
      const centerTolerance = Math.max(
        1.25,
        Math.min(existing.box.width, existing.box.height, candidate.box.width, candidate.box.height) * 0.22
      );
      const areaRatio = Math.min(candidateArea, existingArea) / Math.max(candidateArea, existingArea, 1);

      // High overlap alone is not enough: nested frames and offset architectural
      // outlines can overlap heavily while still representing distinct useful masks.
      // Require comparable dimensions and aligned centers before collapsing them.
      const geometryAligned = sizeSimilar && areaRatio >= 0.62 && centerDistance <= centerTolerance;
      return geometryAligned && overlap >= 0.68;
    });

    if (!duplicatesExisting) kept.push(candidate);
  }

  return kept.sort((a, b) => (a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
await fs.writeFile(path, source);
console.log("Collapsed only strongly overlapping, size-matched, center-aligned automatic-mask duplicates before review without replacing adjacent cleanup helpers.");
