import fs from "node:fs";

const detectorPath = "src/core/architecturalDetector.ts";
const source = fs.readFileSync(detectorPath, "utf8");

const requiredSnippets = `
const downDiagonalBridge = binaryGrid[y - 1][x - 1] === 1 && binaryGrid[y + 1][x + 1] === 1;
const upDiagonalBridge = binaryGrid[y + 1][x - 1] === 1 && binaryGrid[y - 1][x + 1] === 1;
const neighborLabels = [
x > 0 && y > 0 ? labelGrid[y - 1][x - 1] : 0,
x < resolution - 1 && y > 0 ? labelGrid[y - 1][x + 1] : 0
for (let i = 1; i < neighborLabels.length; i += 1)
`
  .trim()
  .split("\n");

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missing.length > 0) {
  console.error("Detector connectivity smoke test failed. Missing snippets:");
  for (const snippet of missing) {
    console.error(`- ${snippet}`);
  }
  process.exit(1);
}

console.log("Detector connectivity smoke test passed: diagonal bridging and 8-connected labeling are present.");
