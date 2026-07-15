import fs from "node:fs/promises";

const adapter = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const app = await fs.readFile("src/App.tsx", "utf8");

const requiredAdapterMarkers = [
  "export type MaskCandidateStats",
  "export function getLastMaskCandidateStats",
  "const rankedMasks = prioritizeArchitecturalOpenings",
  "truncated: rankedMasks.length > finalMasks.length"
];

for (const marker of requiredAdapterMarkers) {
  if (!adapter.includes(marker)) {
    throw new Error(`Missing mask truncation marker: ${marker}`);
  }
}

if (!app.includes('import { getLastMaskCandidateStats } from "./core/maskCandidateAdapter";')) {
  throw new Error("Mask truncation stats are not imported by the UI");
}
if (!app.includes("getLastMaskCandidateStats().truncated")) {
  throw new Error("UI warning is not driven by actual truncation state");
}
if (!app.includes("Additional detector masks need manual review")) {
  throw new Error("Accurate user-facing truncation warning is missing");
}
if (app.includes('length >= 16 ? <strong className="autoMaskCapWarning"')) {
  throw new Error("Count-only detector-limit warning returned");
}

console.log("accurate automatic-mask truncation warning verified");
