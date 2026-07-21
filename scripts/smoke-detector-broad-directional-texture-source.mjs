import fs from "node:fs/promises";

const source = await fs.readFile("src/core/architecturalDetector.ts", "utf8");
const required = [
  "const structuralBalance =",
  "const componentAreaPercent = wPct * hPct;",
  "const broadDirectionalTexture = componentAreaPercent >= 1200 && structuralBalance < 0.08;",
  "if (broadDirectionalTexture)",
  "score += Math.floor(structuralBalance * 20);"
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing broad directional texture marker: ${marker}`);
  }
}

console.log("broad directional texture source smoke passed");
