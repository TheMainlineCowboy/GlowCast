import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "lastRejectedAutoMask",
  "setLastRejectedAutoMask(selectedAutoMask);",
  "const undoLastAutoMaskRejection = () =>",
  "Restored the last rejected automatic mask for review.",
  "Undo Last Rejection",
  "disabled={!lastRejectedAutoMask}",
  "setSelectedZoneId(lastRejectedAutoMask.id);",
  'event.key.toLowerCase() === "u"',
  "undoLastAutoMaskRejection();",
  "Keyboard: A approve · R/Delete reject · U undo",
  "[zones, selectedZoneId, lastRejectedAutoMask]"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Undo-auto-mask source marker missing: ${marker}`);
}

console.log("Undo automatic-mask rejection source and keyboard shortcut smoke passed.");
