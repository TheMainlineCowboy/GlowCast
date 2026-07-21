import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

if (!source.includes("const selectOverlappingAutoMask = (direction: 1 | -1)")) {
  const reviewStart = source.indexOf("  const reviewNextOverlappingAutoMask = () => {");
  const removalStart = source.indexOf("\n  const removeOverlappingAutoMasks = () => {", reviewStart);
  if (reviewStart < 0 || removalStart < 0) throw new Error("Overlap review function anchors not found.");

  const replacement = `  const selectOverlappingAutoMask = (direction: 1 | -1) => {\n    const overlapCandidates = zones.filter((zone) => overlappingAutoMaskIds.has(zone.id));\n    if (overlapCandidates.length === 0) return;\n    const currentIndex = selectedZoneId === null\n      ? -1\n      : overlapCandidates.findIndex((zone) => zone.id === selectedZoneId);\n    const fallbackIndex = direction === 1 ? 0 : overlapCandidates.length - 1;\n    const nextIndex = currentIndex < 0\n      ? fallbackIndex\n      : (currentIndex + direction + overlapCandidates.length) % overlapCandidates.length;\n    const nextCandidate = overlapCandidates[nextIndex];\n    setSelectedZoneId(nextCandidate.id);\n    setDetectMessage(\`Reviewing overlap pair \${nextIndex + 1} of \${overlapCandidates.length}. Red REMOVE will be discarded; green KEEP will remain.\`);\n  };\n\n  const reviewNextOverlappingAutoMask = () => selectOverlappingAutoMask(1);\n  const reviewPreviousOverlappingAutoMask = () => selectOverlappingAutoMask(-1);\n  const exitOverlappingAutoMaskReview = () => {\n    if (selectedZoneId === null || !overlappingAutoMaskIds.has(selectedZoneId)) return;\n    setSelectedZoneId(null);\n    setDetectMessage(\"Overlap review closed. No masks were removed.\");\n  };\n\n  useEffect(() => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    const handleOverlapReviewKeyDown = (event: KeyboardEvent) => {\n      const target = event.target as HTMLElement | null;\n      if (target?.closest(\"input, textarea, select, [contenteditable='true']\")) return;\n      if (event.altKey || event.ctrlKey || event.metaKey) return;\n      if (event.key === \"Escape\") {\n        if (selectedZoneId !== null && overlappingAutoMaskIds.has(selectedZoneId)) {\n          event.preventDefault();\n          exitOverlappingAutoMaskReview();\n        }\n        return;\n      }\n      if (event.key !== \"ArrowLeft\" && event.key !== \"ArrowRight\") return;\n      event.preventDefault();\n      selectOverlappingAutoMask(event.key === \"ArrowRight\" ? 1 : -1);\n    };\n    window.addEventListener(\"keydown\", handleOverlapReviewKeyDown);\n    return () => window.removeEventListener(\"keydown\", handleOverlapReviewKeyDown);\n  }, [zones, selectedZoneId]);\n`;

  source = source.slice(0, reviewStart) + replacement + source.slice(removalStart + 1);
} else if (!source.includes("const exitOverlappingAutoMaskReview = () =>")) {
  const previousReview = "  const reviewPreviousOverlappingAutoMask = () => selectOverlappingAutoMask(-1);";
  if (!source.includes(previousReview)) throw new Error("Overlap previous-review helper anchor not found.");
  const exitHelper = `${previousReview}\n  const exitOverlappingAutoMaskReview = () => {\n    if (selectedZoneId === null || !overlappingAutoMaskIds.has(selectedZoneId)) return;\n    setSelectedZoneId(null);\n    setDetectMessage(\"Overlap review closed. No masks were removed.\");\n  };`;
  source = source.replace(previousReview, exitHelper);

  const keyGate = '      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;';
  if (!source.includes(keyGate)) throw new Error("Overlap keyboard gate anchor not found.");
  source = source.replace(
    keyGate,
    `      if (event.key === "Escape") {\n        if (selectedZoneId !== null && overlappingAutoMaskIds.has(selectedZoneId)) {\n          event.preventDefault();\n          exitOverlappingAutoMaskReview();\n        }\n        return;\n      }\n${keyGate}`
  );
}

if (!source.includes("←/→ review pairs")) {
  const reviewButtonStart = source.indexOf("onClick={reviewNextOverlappingAutoMask}");
  const reviewButtonEnd = source.indexOf("</button>", reviewButtonStart);
  if (reviewButtonStart < 0 || reviewButtonEnd < 0) throw new Error("Overlap review button anchor not found.");
  const insertionIndex = reviewButtonEnd + "</button>".length;
  source = source.slice(0, insertionIndex) + `\n              <span className="muted" aria-label="Overlap review keyboard shortcuts">←/→ review pairs</span>` + source.slice(insertionIndex);
}

if (!source.includes("Exit Review (Esc)")) {
  const shortcutHint = '<span className="muted" aria-label="Overlap review keyboard shortcuts">←/→ review pairs</span>';
  if (!source.includes(shortcutHint)) throw new Error("Overlap shortcut hint anchor not found.");
  const exitButton = `\n              <button type="button" onClick={exitOverlappingAutoMaskReview} disabled={selectedZoneId === null || !overlappingAutoMaskIds.has(selectedZoneId)} aria-label="Exit overlap review without removing masks">\n                Exit Review (Esc)\n              </button>`;
  source = source.replace(shortcutHint, shortcutHint + exitButton);
}

if (!source.includes("Use Left and Right Arrow keys to review overlap pairs")) {
  const label = 'aria-label="Select the next automatic mask that would be removed as an overlap"';
  if (!source.includes(label)) throw new Error("Overlap review button accessibility anchor not found.");
  source = source.replace(label, `${label} title="Use Left and Right Arrow keys to review overlap pairs"`);
}

await fs.writeFile(path, source);
console.log("Applied overlap review keyboard navigation and a safe exit action.");
