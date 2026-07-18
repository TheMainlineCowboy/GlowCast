import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldSelection = "    const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);";
const marker = "const overlappingCandidates = next";
const qualityMarker = "perimeterSides:";

if (source.includes(marker) && source.includes(qualityMarker) && !source.includes(oldSelection)) {
  console.log("Perimeter-quality nested fallback overlap selection already applied.");
  process.exit(0);
}

if (source.includes(marker) && !source.includes(oldSelection)) {
  const oldDeterministicSelection = `    // Resolve overlapping established masks deterministically. Stronger overlap wins;
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
    const duplicateIndex = overlappingCandidates[0]?.index ?? -1;`;

  if (!source.includes(oldDeterministicSelection)) {
    throw new Error("Existing deterministic fallback selection block was not recognized.");
  }

  source = source.replace(oldDeterministicSelection, buildSelectionBlock());
} else {
  if (!source.includes(oldSelection)) {
    throw new Error("Fallback duplicate-selection anchor not found.");
  }
  source = source.replace(oldSelection, buildSelectionBlock());
}

if (!source.includes(marker) || !source.includes(qualityMarker) || source.includes(oldSelection)) {
  throw new Error("Perimeter-quality nested fallback overlap selection was not applied.");
}

await fs.writeFile(path, source);
console.log("Selected nested fallback overlap targets by overlap, perimeter completeness, established surface size, and stable order.");

function buildSelectionBlock() {
  return `    // Resolve overlapping established masks deterministically. Stronger overlap wins;
    // for nested ties, prefer the candidate whose own outline supports more box sides
    // before using smaller surface area and stable input order as tie-breakers.
    const overlappingCandidates = next
      .map((existing, index) => {
        const sideTolerance = Math.max(1.2, Math.min(existing.box.width, existing.box.height) * 0.04);
        let top = false;
        let bottom = false;
        let left = false;
        let right = false;
        for (const point of existing.points) {
          if (Math.abs(point.y - existing.box.y) <= sideTolerance) top = true;
          if (Math.abs(point.y - (existing.box.y + existing.box.height)) <= sideTolerance) bottom = true;
          if (Math.abs(point.x - existing.box.x) <= sideTolerance) left = true;
          if (Math.abs(point.x - (existing.box.x + existing.box.width)) <= sideTolerance) right = true;
        }
        return {
          index,
          overlap: overlapRatio(existing.box, box),
          perimeterSides: [top, bottom, left, right].filter(Boolean).length,
          area: existing.box.width * existing.box.height
        };
      })
      .filter((candidate) => candidate.overlap > 0.58)
      .sort((a, b) =>
        b.overlap - a.overlap ||
        b.perimeterSides - a.perimeterSides ||
        a.area - b.area ||
        a.index - b.index
      );
    const duplicateIndex = overlappingCandidates[0]?.index ?? -1;`;
}
