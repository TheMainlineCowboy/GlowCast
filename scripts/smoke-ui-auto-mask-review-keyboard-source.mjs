import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredSnippets = [
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
    throw new Error(`Auto-mask review keyboard regression missing: ${snippet}`);
  }
}

if (!source.includes("input, textarea, select, [contenteditable='true']")) {
  throw new Error("Keyboard shortcuts must ignore editable controls.");
}

if (!source.includes("!zone.included")) {
  throw new Error("Keyboard shortcuts must remain limited to reviewable automatic masks.");
}

console.log("Automatic-mask review keyboard shortcut UI smoke passed.");
