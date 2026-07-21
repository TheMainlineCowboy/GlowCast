import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const requiredMarkers = [
  "const selectOverlappingAutoMask = (direction: 1 | -1)",
  "const reviewPreviousOverlappingAutoMask = () => selectOverlappingAutoMask(-1)",
  "const exitOverlappingAutoMaskReview = () =>",
  "Overlap review closed. No masks were removed.",
  "event.key === \"Escape\"",
  "exitOverlappingAutoMaskReview();",
  "event.key !== \"ArrowLeft\" && event.key !== \"ArrowRight\"",
  "selectOverlappingAutoMask(event.key === \"ArrowRight\" ? 1 : -1)",
  "input, textarea, select, [contenteditable='true']",
  "←/→ review pairs",
  "Exit Review (Esc)",
  "Exit overlap review without removing masks",
  "Use Left and Right Arrow keys to review overlap pairs"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Overlap review keyboard marker missing: ${marker}`);
}

console.log("Overlap review keyboard navigation and safe exit source smoke passed.");
