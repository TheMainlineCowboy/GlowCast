import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "16-mask detector limit reached",
  "GlowCast currently keeps the 16 strongest automatic architectural masks",
  ".length >= 16",
  'className="autoMaskCapWarning"'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing automatic mask cap-warning marker: ${marker}`);
  }
}

if (source.includes("10-mask detector limit reached")) {
  throw new Error("Obsolete ten-mask detector warning returned.");
}

console.log("Automatic mask result-cap warning source verified.");
