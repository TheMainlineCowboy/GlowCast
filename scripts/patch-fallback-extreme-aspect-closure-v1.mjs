import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const anchor = "    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;";
const enhanced = `    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;
    // Very wide or very tall fallback components are especially likely to be trim,
    // seams, gutters, or railings. Require a fully closed outline before exposing
    // them as automatic masks, while preserving three-sided recovery for ordinary
    // doors, arches, and windows.
    const extremeAspect = aspect < 0.35 || aspect > 3.2;
    if (extremeAspect && sideCoverage.sides < 4) continue;`;

if (source.includes("const extremeAspect = aspect < 0.35 || aspect > 3.2;")) {
  console.log("Extreme-aspect fallback closure gate already present.");
} else if (source.includes(anchor)) {
  source = source.replace(anchor, enhanced);
  await fs.writeFile(path, source);
  console.log("Required complete closure for extreme-aspect fallback masks.");
} else {
  throw new Error("Fallback side-coverage anchor not found.");
}
