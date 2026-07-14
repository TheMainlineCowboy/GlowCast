import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const required of [
  "verticalAlignment >= 0.62",
  "satellite.height >= parent.height * 0.62",
  "satellite.width <= parent.width * 0.58",
  "horizontalAlignment >= 0.62",
  "satellite.width >= parent.width * 0.62",
  "satellite.height <= parent.height * 0.58"
]) {
  if (!source.includes(required)) {
    throw new Error(`corner-touching satellite gate missing: ${required}`);
  }
}

console.log("corner-touching satellite rejection source verified");
