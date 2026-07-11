import fs from "node:fs/promises";

const detectorPath = "src/core/architecturalDetector.ts";
let detector = await fs.readFile(detectorPath, "utf8");

const marker = "const fullFrameClosureBonus = frameCoverage.sidesPresent === 4 ? 8 : 0;";
if (!detector.includes(marker)) {
  const target = "    score += frameCoverage.scoreBoost;";
  if (!detector.includes(target)) {
    throw new Error("Unable to locate architectural frame coverage score anchor");
  }

  detector = detector.replace(
    target,
    `    // Prefer fully closed architectural outlines over equally dense three-sided fallbacks.\n    // Keep the bonus deliberately small so strong doorway recovery remains available.\n    const fullFrameClosureBonus = frameCoverage.sidesPresent === 4 ? 8 : 0;\n    score += frameCoverage.scoreBoost + fullFrameClosureBonus;`
  );

  await fs.writeFile(detectorPath, detector);
  console.log("added conservative closed-frame ranking bonus");
} else {
  console.log("closed-frame ranking bonus already present");
}
