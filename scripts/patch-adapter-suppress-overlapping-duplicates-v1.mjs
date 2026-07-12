import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function suppressGroupedDuplicates(";
if (source.includes(marker)) {
  console.log("overlapping grouped-mask duplicate suppression patch already applied");
  process.exit(0);
}

const groupStart = source.indexOf("function groupNearbySatellites(");
if (groupStart < 0) throw new Error("Unable to locate satellite grouping function");

const helper = `function suppressGroupedDuplicates(candidates: MaskCandidateOutput[]): MaskCandidateOutput[] {
  const ranked = [...candidates].sort((a, b) => {
    const areaDelta = b.box.width * b.box.height - a.box.width * a.box.height;
    if (areaDelta !== 0) return areaDelta;
    return a.id.localeCompare(b.id);
  });
  const kept: MaskCandidateOutput[] = [];

  for (const candidate of ranked) {
    const duplicatesExisting = kept.some((existing) => overlapRatio(existing.box, candidate.box) >= 0.78);
    if (!duplicatesExisting) kept.push(candidate);
  }

  return kept.sort((a, b) => (a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y));
}

`;

source = source.slice(0, groupStart) + helper + source.slice(groupStart);

const groupEnd = source.indexOf("\nfunction getFallbackSideCoverage", groupStart + helper.length);
if (groupEnd < 0) throw new Error("Unable to locate end of satellite grouping function");

let groupSource = source.slice(groupStart + helper.length, groupEnd);
const returnAnchor = "  return grouped;";
if (!groupSource.includes(returnAnchor)) throw new Error("Unable to locate grouped-mask return statement");
groupSource = groupSource.replace(returnAnchor, "  return suppressGroupedDuplicates(grouped);");
source = source.slice(0, groupStart + helper.length) + groupSource + source.slice(groupEnd);

await fs.writeFile(adapterPath, source);
console.log("applied overlapping grouped-mask duplicate suppression patch");
