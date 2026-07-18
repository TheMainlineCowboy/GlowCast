import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldSelection = "    const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);";
const marker = "const overlappingCandidates = next";

if (source.includes(marker) && !source.includes(oldSelection)) {
  console.log("Deterministic nested fallback overlap selection already applied.");
  process.exit(0);
}

if (!source.includes(oldSelection)) {
  throw new Error("Fallback duplicate-selection anchor not found.");
}

source = source.replace(
  oldSelection,
  `    // Resolve overlapping established masks deterministically. Stronger overlap wins;
    // when nested candidates are fully contained and therefore tie, preserve the
    // smallest established projectable surface instead of whichever candidate happened
    // to appear first in detector output.
    const overlappingCandidates = next
      .map((existing, index) => ({
        index,
        overlap: overlapRatio(existing.box, box),
        area: existing.box.width * existing.box.height
      }))
      .filter((candidate) => candidate.overlap > 0.58)
      .sort((a, b) => b.overlap - a.overlap || a.area - b.area || a.index - b.index);
    const duplicateIndex = overlappingCandidates[0]?.index ?? -1;`
);

if (!source.includes(marker) || source.includes(oldSelection)) {
  throw new Error("Deterministic nested fallback overlap selection was not applied.");
}

await fs.writeFile(path, source);
console.log("Selected nested fallback overlap targets deterministically by overlap and established surface size.");
