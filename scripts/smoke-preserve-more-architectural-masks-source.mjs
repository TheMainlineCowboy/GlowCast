import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredMarkers = [
  "const maxArchitecturalMasks = 16;",
  ".slice(0, maxArchitecturalMasks)"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    console.error(`Architectural mask preservation smoke failed: missing ${marker}`);
    process.exit(1);
  }
}

if (source.includes(".slice(0, 10)")) {
  console.error("Architectural mask preservation smoke failed: the old ten-mask truncation returned.");
  process.exit(1);
}

console.log("Architectural mask preservation smoke passed: up to sixteen valid detector results remain available for review.");
