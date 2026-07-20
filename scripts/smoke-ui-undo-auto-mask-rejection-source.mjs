import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "lastRejectedAutoMask",
  "setLastRejectedAutoMask(selectedAutoMask);",
  "const undoLastAutoMaskRejection = () =>",
  "Restored the last rejected automatic mask for review.",
  "Undo Last Rejection",
  "disabled={!lastRejectedAutoMask}",
  "setSelectedZoneId(lastRejectedAutoMask.id);"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Undo-auto-mask source marker missing: ${marker}`);
}

console.log("Undo automatic-mask rejection source smoke passed.");
