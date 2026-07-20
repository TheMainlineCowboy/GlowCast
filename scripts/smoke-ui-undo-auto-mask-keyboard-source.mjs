import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  'event.key.toLowerCase() === "u"',
  "undoLastAutoMaskRejection();",
  "lastRejectedAutoMask",
  "Keyboard: A approve · R/Delete reject · U undo",
  "[zones, selectedZoneId, lastRejectedAutoMask]"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Undo keyboard source marker missing: ${marker}`);
}

if (!source.includes("event.preventDefault();")) {
  throw new Error("Undo shortcut must prevent the browser default action.");
}

console.log("Automatic-mask undo keyboard shortcut source smoke passed.");
