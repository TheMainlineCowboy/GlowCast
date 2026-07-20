import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredSnippets = [
  "const rejectSelectedAutoMask = () => {",
  "currentZones.filter((zone) => zone.id !== selectedAutoMask.id)",
  "setSelectedZoneId(nextAutoMask?.id ?? null)",
  "Reject & Review Next Auto Mask",
  'aria-label="Delete the selected automatic mask and review the next disabled automatic mask"',
  "Rejected automatic mask.",
  "Review complete.",
  "Auto-mask review keyboard shortcuts",
  "window.addEventListener(\"keydown\", handleAutoMaskReviewKey)",
  "window.removeEventListener(\"keydown\", handleAutoMaskReviewKey)",
  "event.key.toLowerCase() === \"a\"",
  "event.key.toLowerCase() === \"r\"",
  "event.key === \"Delete\"",
  "event.key === \"Backspace\"",
  "approveSelectedAutoMask();",
  "rejectSelectedAutoMask();",
  "Keyboard: A approve · R/Delete reject",
  "Automatic mask review keyboard shortcuts"
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Reject-and-advance UI regression missing: ${snippet}`);
  }
}

if (!source.includes("disabled={!zones.some((zone) => zone.id === selectedZoneId")) {
  throw new Error("Reject action must remain disabled unless a reviewable automatic mask is selected.");
}

if (!source.includes("input, textarea, select, [contenteditable='true']")) {
  throw new Error("Keyboard shortcuts must ignore editable controls.");
}

if (!source.includes("!selectedAutoMask || event.altKey || event.ctrlKey || event.metaKey")) {
  throw new Error("Keyboard shortcuts must stay scoped to reviewable masks and avoid modified key commands.");
}

console.log("Selected automatic-mask reject-and-advance UI and keyboard shortcut smoke passed.");
