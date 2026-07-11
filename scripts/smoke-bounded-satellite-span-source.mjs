import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "satellite.height <= parent.height * 1.55",
  "satellite.width <= parent.width * 1.55",
  "verticalCenterOffsetRatio <= 0.28",
  "horizontalCenterOffsetRatio <= 0.28"
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length > 0) {
  throw new Error(`Bounded satellite span source smoke failed; missing: ${missing.join(", ")}`);
}

console.log("bounded satellite span source smoke passed");
