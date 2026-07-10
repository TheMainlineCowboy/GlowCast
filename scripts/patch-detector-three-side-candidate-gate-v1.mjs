import fs from "node:fs/promises";

const path = "src/core/architecturalDetector.ts";
let source = await fs.readFile(path, "utf8");

const oldBlock = `    const frameCoverage = getFrameCoverage(component.points, xPct, yPct, wPct, hPct);
    score += frameCoverage.scoreBoost;
`;

const newBlock = `    const frameCoverage = getFrameCoverage(component.points, xPct, yPct, wPct, hPct);
    // Detector candidates should be mostly closed architectural outlines.
    // Two-sided L/corner fragments can look square and balanced, but they are
    // not reliable auto masks; keep 3-sided doorway/arch-style recovery.
    if (frameCoverage.sidesPresent < 3) return;
    score += frameCoverage.scoreBoost;
`;

if (!source.includes("frameCoverage.sidesPresent < 3")) {
  if (!source.includes(oldBlock)) {
    throw new Error("detector three-side gate target not found");
  }
  source = source.replace(oldBlock, newBlock);
  await fs.writeFile(path, source);
  console.log("patched detector three-side candidate gate");
} else {
  console.log("detector three-side candidate gate already present");
}
