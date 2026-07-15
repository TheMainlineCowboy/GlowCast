import fs from "node:fs/promises";

const app = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "additional mask(s) need manual review",
  "getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned",
  "lower-ranked result(s)"
];

for (const marker of requiredMarkers) {
  if (!app.includes(marker)) {
    throw new Error(`Missing omitted-mask count marker: ${marker}`);
  }
}

if (app.includes("Additional detector masks need manual review</strong>")) {
  throw new Error("Count-free detector truncation warning returned");
}

console.log("omitted automatic-mask count verified");
