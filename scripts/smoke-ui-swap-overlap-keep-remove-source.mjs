import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const requiredMarkers = [
  "swappedOverlapRemovalIds",
  "detectedOverlapByRemovedId",
  "retainedOverlapByRemovedId.set(detectedKeepId, detectedRemoveId)",
  "const swapSelectedOverlapDecision = () =>",
  "setSwappedOverlapRemovalIds((current) =>",
  "setSelectedZoneId(currentlySwapped ? detectedRemoveId : detectedKeepId)",
  "Swap Keep / Remove",
  'aria-label="Swap which mask is kept and removed for the selected overlap pair"'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Overlap keep/remove swap marker missing: ${marker}`);
}

console.log("Overlap keep/remove swap source smoke passed.");
