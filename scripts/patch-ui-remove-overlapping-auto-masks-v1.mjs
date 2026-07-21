import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const helperMarker = "  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {";
const reviewNavigation = `  const selectOverlappingAutoMask = (direction: 1 | -1) => {\n    const overlapCandidates = zones.filter((zone) => overlappingAutoMaskIds.has(zone.id));\n    if (overlapCandidates.length === 0) return;\n    const currentIndex = selectedZoneId === null\n      ? -1\n      : overlapCandidates.findIndex((zone) => zone.id === selectedZoneId);\n    const fallbackIndex = direction === 1 ? 0 : overlapCandidates.length - 1;\n    const nextIndex = currentIndex < 0\n      ? fallbackIndex\n      : (currentIndex + direction + overlapCandidates.length) % overlapCandidates.length;\n    const nextCandidate = overlapCandidates[nextIndex];\n    setSelectedZoneId(nextCandidate.id);\n    setDetectMessage(\`Reviewing overlap pair \${nextIndex + 1} of \${overlapCandidates.length}. Red REMOVE will be discarded; green KEEP will remain.\`);\n  };\n\n  const reviewNextOverlappingAutoMask = () => selectOverlappingAutoMask(1);\n  const reviewPreviousOverlappingAutoMask = () => selectOverlappingAutoMask(-1);\n\n  useEffect(() => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    const handleOverlapReviewKeyDown = (event: KeyboardEvent) => {\n      const target = event.target as HTMLElement | null;\n      if (target?.closest(\"input, textarea, select, [contenteditable='true']\")) return;\n      if (event.altKey || event.ctrlKey || event.metaKey) return;\n      if (event.key !== \"ArrowLeft\" && event.key !== \"ArrowRight\") return;\n      event.preventDefault();\n      selectOverlappingAutoMask(event.key === \"ArrowRight\" ? 1 : -1);\n    };\n    window.addEventListener(\"keydown\", handleOverlapReviewKeyDown);\n    return () => window.removeEventListener(\"keydown\", handleOverlapReviewKeyDown);\n  }, [zones, selectedZoneId]);\n`;
const helper = `  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {\n    const autoMasks = candidateZones.filter((zone) => ${autoMaskCheck});\n    const duplicateIds = new Set<number>();\n    const retainedIds = new Set<number>();\n    const retainedByDuplicateId = new Map<number, number>();\n    for (let index = 0; index < autoMasks.length; index += 1) {\n      const first = autoMasks[index];\n      if (duplicateIds.has(first.id)) continue;\n      for (let compareIndex = index + 1; compareIndex < autoMasks.length; compareIndex += 1) {\n        const second = autoMasks[compareIndex];\n        if (duplicateIds.has(second.id)) continue;\n        const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));\n        const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));\n        const overlapArea = overlapWidth * overlapHeight;\n        if (overlapArea <= 0) continue;\n        const firstArea = Math.max(0.0001, first.width * first.height);\n        const secondArea = Math.max(0.0001, second.width * second.height);\n        const unionArea = firstArea + secondArea - overlapArea;\n        const intersectionOverUnion = overlapArea / unionArea;\n        const smallerCoverage = overlapArea / Math.min(firstArea, secondArea);\n        if (intersectionOverUnion >= 0.82 || smallerCoverage >= 0.94) {\n          const firstPriority = (first.included ? 2 : 0) + firstArea / 10000;\n          const secondPriority = (second.included ? 2 : 0) + secondArea / 10000;\n          const removeId = firstPriority >= secondPriority ? second.id : first.id;\n          const keepId = removeId === first.id ? second.id : first.id;\n          duplicateIds.add(removeId);\n          retainedIds.add(keepId);\n          retainedByDuplicateId.set(removeId, keepId);\n        }\n      }\n    }\n    return { duplicateIds, retainedIds, retainedByDuplicateId };\n  };\n\n  const {\n    duplicateIds: overlappingAutoMaskIds,\n    retainedIds: retainedOverlappingAutoMaskIds,\n    retainedByDuplicateId: retainedOverlapByRemovedId\n  } = findOverlappingAutoMaskIds(zones);\n  const selectedRetainedOverlapId = selectedZoneId === null\n    ? null\n    : retainedOverlapByRemovedId.get(selectedZoneId) ?? null;\n  const overlapReviewPosition = selectedZoneId === null\n    ? null\n    : zones\n        .filter((zone) => overlappingAutoMaskIds.has(zone.id))\n        .findIndex((zone) => zone.id === selectedZoneId) + 1;\n\n${reviewNavigation}\n  const removeOverlappingAutoMasks = () => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    setZones((currentZones) => currentZones.filter((zone) => !overlappingAutoMaskIds.has(zone.id)));\n    if (selectedZoneId !== null && overlappingAutoMaskIds.has(selectedZoneId)) setSelectedZoneId(null);\n    setDetectMessage(\`Removed \${overlappingAutoMaskIds.size} overlapping automatic mask\${overlappingAutoMaskIds.size === 1 ? "" : "s"}.\`);\n  };\n`;

if (!source.includes(helperMarker)) {
  const bulkActionStart = source.indexOf("  const setAllAutoMasksIncluded = (included: boolean) => {");
  if (bulkActionStart < 0) throw new Error("Automatic-mask bulk action anchor not found.");
  const bulkActionEnd = source.indexOf("\n  };", bulkActionStart);
  if (bulkActionEnd < 0) throw new Error("Automatic-mask bulk action end not found.");
  const insertionIndex = bulkActionEnd + "\n  };".length;
  source = source.slice(0, insertionIndex) + "\n\n" + helper + source.slice(insertionIndex);
} else if (!source.includes("retainedOverlapByRemovedId")) {
  const retainedDeclaration = "    const retainedIds = new Set<number>();";
  const retainedAdd = "          retainedIds.add(keepId);";
  const oldReturn = "    return { duplicateIds, retainedIds };";
  const oldAssignment = "  const { duplicateIds: overlappingAutoMaskIds, retainedIds: retainedOverlappingAutoMaskIds } = findOverlappingAutoMaskIds(zones);";
  for (const marker of [retainedDeclaration, retainedAdd, oldReturn, oldAssignment]) {
    if (!source.includes(marker)) throw new Error(`Existing overlap pair-map upgrade marker not found: ${marker}`);
  }
  source = source
    .replace(retainedDeclaration, `${retainedDeclaration}\n    const retainedByDuplicateId = new Map<number, number>();`)
    .replace(retainedAdd, `${retainedAdd}\n          retainedByDuplicateId.set(removeId, keepId);`)
    .replace(oldReturn, "    return { duplicateIds, retainedIds, retainedByDuplicateId };")
    .replace(
      oldAssignment,
      `  const {\n    duplicateIds: overlappingAutoMaskIds,\n    retainedIds: retainedOverlappingAutoMaskIds,\n    retainedByDuplicateId: retainedOverlapByRemovedId\n  } = findOverlappingAutoMaskIds(zones);\n  const selectedRetainedOverlapId = selectedZoneId === null\n    ? null\n    : retainedOverlapByRemovedId.get(selectedZoneId) ?? null;`
    );
}

if (!source.includes("const selectOverlappingAutoMask = (direction: 1 | -1)")) {
  const oldReviewStart = source.indexOf("  const reviewNextOverlappingAutoMask = () => {");
  const removalMarker = "\n  const removeOverlappingAutoMasks = () => {";
  const removalIndex = source.indexOf(removalMarker, oldReviewStart);
  if (oldReviewStart < 0 || removalIndex < 0) throw new Error("Existing overlap review helper anchor not found.");
  source = source.slice(0, oldReviewStart) + reviewNavigation + source.slice(removalIndex + 1);
}

if (!source.includes("const overlapReviewPosition = selectedZoneId === null")) {
  const selectedPairEnd = "    : retainedOverlapByRemovedId.get(selectedZoneId) ?? null;";
  const selectedPairIndex = source.indexOf(selectedPairEnd);
  if (selectedPairIndex < 0) throw new Error("Selected overlap pair anchor not found for progress indicator.");
  const insertionIndex = selectedPairIndex + selectedPairEnd.length;
  const progress = `\n  const overlapReviewPosition = selectedZoneId === null\n    ? null\n    : zones\n        .filter((zone) => overlappingAutoMaskIds.has(zone.id))\n        .findIndex((zone) => zone.id === selectedZoneId) + 1;`;
  source = source.slice(0, insertionIndex) + progress + source.slice(insertionIndex);
}

const reviewButton = `              <button type="button" onClick={reviewNextOverlappingAutoMask} disabled={overlappingAutoMaskIds.size === 0} aria-label="Select the next automatic mask that would be removed as an overlap" title="Use Left and Right Arrow keys to review overlap pairs">\n                {overlapReviewPosition && overlapReviewPosition > 0\n                  ? \`Pair \${overlapReviewPosition} of \${overlappingAutoMaskIds.size}\`\n                  : \`Review Overlaps (\${overlappingAutoMaskIds.size})\`}\n              </button>\n              <span className="muted" aria-label="Overlap review keyboard shortcuts">←/→ review pairs</span>\n`;
const button = `              <button type="button" onClick={removeOverlappingAutoMasks} disabled={overlappingAutoMaskIds.size === 0} aria-label="Remove heavily overlapping automatic masks and keep the strongest candidate">\n                Remove Overlaps ({overlappingAutoMaskIds.size})\n              </button>\n`;

if (!source.includes("Remove Overlaps ({overlappingAutoMaskIds.size})")) {
  const disableButton = source.indexOf("Disable All Auto Masks");
  if (disableButton < 0) throw new Error("Automatic-mask bulk button anchor not found.");
  const buttonEnd = source.indexOf("</button>", disableButton);
  if (buttonEnd < 0) throw new Error("Automatic-mask bulk button end not found.");
  const insertionIndex = buttonEnd + "</button>".length;
  source = source.slice(0, insertionIndex) + "\n" + reviewButton.trimEnd() + "\n" + button.trimEnd() + source.slice(insertionIndex);
} else {
  if (!source.includes("Pair ${overlapReviewPosition} of ${overlappingAutoMaskIds.size}")) {
    const oldReviewLabel = "                Review Overlaps ({overlappingAutoMaskIds.size})";
    if (!source.includes(oldReviewLabel)) throw new Error("Overlapping-mask review label anchor not found.");
    const newReviewLabel = `                {overlapReviewPosition && overlapReviewPosition > 0\n                  ? \`Pair \${overlapReviewPosition} of \${overlappingAutoMaskIds.size}\`\n                  : \`Review Overlaps (\${overlappingAutoMaskIds.size})\`}`;
    source = source.replace(oldReviewLabel, newReviewLabel);
  }
  if (!source.includes("←/→ review pairs")) {
    const reviewButtonEnd = source.indexOf("</button>", source.indexOf("onClick={reviewNextOverlappingAutoMask}"));
    if (reviewButtonEnd < 0) throw new Error("Overlap review button end not found for shortcut hint.");
    const insertionIndex = reviewButtonEnd + "</button>".length;
    source = source.slice(0, insertionIndex) + `\n              <span className="muted" aria-label="Overlap review keyboard shortcuts">←/→ review pairs</span>` + source.slice(insertionIndex);
  }
  if (!source.includes("Use Left and Right Arrow keys to review overlap pairs")) {
    source = source.replace(
      'aria-label="Select the next automatic mask that would be removed as an overlap"',
      'aria-label="Select the next automatic mask that would be removed as an overlap" title="Use Left and Right Arrow keys to review overlap pairs"'
    );
  }
}

await fs.writeFile(path, source);
await import("./patch-ui-overlap-candidate-warning-v1.mjs");
await import("./smoke-ui-overlap-review-progress-source.mjs");
console.log("Applied overlapping automatic-mask cleanup, pair review navigation, keyboard shortcuts, and pair progress.");
