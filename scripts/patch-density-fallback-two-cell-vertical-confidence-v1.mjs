import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldThreshold = "Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)";
const newThreshold = "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)";

if (source.includes(newThreshold)) {
  console.log("Stricter two-cell vertical mullion confidence already present.");
} else if (source.includes(oldThreshold)) {
  source = source.replace(oldThreshold, newThreshold);
  await fs.writeFile(path, source);
  console.log("Raised confidence required for two-cell off-center vertical mullions.");
} else {
  throw new Error("Two-cell vertical mullion confidence anchor not found.");
}
