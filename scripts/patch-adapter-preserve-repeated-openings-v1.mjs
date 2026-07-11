import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const comparableArchitecturalOpening =";
if (source.includes(marker)) {
  console.log("repeated opening preservation patch already applied");
  process.exit(0);
}

const anchor = `  const parentArea = parent.width * parent.height;\n  const satelliteArea = satellite.width * satellite.height;\n  if (satelliteArea >= parentArea * 0.9) return false;`;
const replacement = `  const parentArea = parent.width * parent.height;\n  const satelliteArea = satellite.width * satellite.height;\n  if (satelliteArea >= parentArea * 0.9) return false;\n\n  const widthRatio = satellite.width / Math.max(parent.width, 0.01);\n  const heightRatio = satellite.height / Math.max(parent.height, 0.01);\n  const comparableArchitecturalOpening =\n    satelliteArea >= parentArea * 0.55 &&\n    widthRatio >= 0.72 && widthRatio <= 1.38 &&\n    heightRatio >= 0.72 && heightRatio <= 1.38;\n  if (comparableArchitecturalOpening) return false;`;

if (!source.includes(anchor)) throw new Error("Unable to locate satellite area gate anchor");
source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("applied repeated opening preservation patch");
