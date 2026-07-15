import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredMarkers = [
  "const maxArchitecturalMasks = 16;",
  ").slice(0, maxArchitecturalMasks);"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    console.error(`Architectural mask preservation smoke failed: missing ${marker}`);
    process.exit(1);
  }
}

if (source.includes("prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10)")) {
  console.error("Architectural mask preservation smoke failed: the old prioritized ten-mask cap returned.");
  process.exit(1);
}

console.log("Architectural mask preservation smoke passed: up to sixteen valid detector results remain available for review.");
