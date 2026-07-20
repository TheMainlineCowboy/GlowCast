import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const helperMarker = "  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {";
const helper = `  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {\n    const autoMasks = candidateZones.filter((zone) => ${autoMaskCheck});\n    const duplicateIds = new Set<number>();\n    const retainedIds = new Set<number>();\n    for (let index = 0; index < autoMasks.length; index += 1) {\n      const first = autoMasks[index];\n      if (duplicateIds.has(first.id)) continue;\n      for (let compareIndex = index + 1; compareIndex < autoMasks.length; compareIndex += 1) {\n        const second = autoMasks[compareIndex];\n        if (duplicateIds.has(second.id)) continue;\n        const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));\n        const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));\n        const overlapArea = overlapWidth * overlapHeight;\n        if (overlapArea <= 0) continue;\n        const firstArea = Math.max(0.0001, first.width * first.height);\n        const secondArea = Math.max(0.0001, second.width * second.height);\n        const unionArea = firstArea + secondArea - overlapArea;\n        const intersectionOverUnion = overlapArea / unionArea;\n        const smallerCoverage = overlapArea / Math.min(firstArea, secondArea);\n        if (intersectionOverUnion >= 0.82 || smallerCoverage >= 0.94) {\n          const firstPriority = (first.included ? 2 : 0) + firstArea / 10000;\n          const secondPriority = (second.included ? 2 : 0) + secondArea / 10000;\n          const removeId = firstPriority >= secondPriority ? second.id : first.id;\n          const keepId = removeId === first.id ? second.id : first.id;\n          duplicateIds.add(removeId);\n          retainedIds.add(keepId);\n        }\n      }\n    }\n    return { duplicateIds, retainedIds };\n  };\n\n  const { duplicateIds: overlappingAutoMaskIds, retainedIds: retainedOverlappingAutoMaskIds } = findOverlappingAutoMaskIds(zones);\n\n  const reviewNextOverlappingAutoMask = () => {\n    const overlapCandidates = zones.filter((zone) => overlappingAutoMaskIds.has(zone.id));\n    if (overlapCandidates.length === 0) return;\n    const currentIndex = selectedZoneId === null\n      ? -1\n      : overlapCandidates.findIndex((zone) => zone.id === selectedZoneId);\n    const nextCandidate = overlapCandidates[(currentIndex + 1) % overlapCandidates.length];\n    setSelectedZoneId(nextCandidate.id);\n    setDetectMessage(\`Reviewing overlap candidate \${currentIndex + 2 > overlapCandidates.length ? 1 : currentIndex + 2} of \${overlapCandidates.length}.\`);\n  };\n\n  const removeOverlappingAutoMasks = () => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    setZones((currentZones) => currentZones.filter((zone) => !overlappingAutoMaskIds.has(zone.id)));\n    if (selectedZoneId !== null && overlappingAutoMaskIds.has(selectedZoneId)) setSelectedZoneId(null);\n    setDetectMessage(\`Removed \${overlappingAutoMaskIds.size} overlapping automatic mask\${overlappingAutoMaskIds.size === 1 ? "" : "s"}.\`);\n  };\n`;

if (!source.includes(helperMarker)) {
  const bulkActionStart = source.indexOf("  const setAllAutoMasksIncluded = (included: boolean) => {");
  if (bulkActionStart < 0) throw new Error("Automatic-mask bulk action anchor not found.");
  const bulkActionEnd = source.indexOf("\n  };", bulkActionStart);
  if (bulkActionEnd < 0) throw new Error("Automatic-mask bulk action end not found.");
  const insertionIndex = bulkActionEnd + "\n  };".length;
  source = source.slice(0, insertionIndex) + "\n\n" + helper + source.slice(insertionIndex);
} else if (!source.includes("retainedOverlappingAutoMaskIds")) {
  const helperEndMarker = "  const reviewNextOverlappingAutoMask = () => {";
  const helperStart = source.indexOf(helperMarker);
  const helperEnd = source.indexOf(helperEndMarker, helperStart);
  if (helperStart < 0 || helperEnd < 0) throw new Error("Existing overlap helper boundaries not found.");
  source = source.slice(0, helperStart) + helper + source.slice(helperEnd + helperEndMarker.length);
} else if (!source.includes("const reviewNextOverlappingAutoMask = () =>")) {
  const removalMarker = "  const removeOverlappingAutoMasks = () => {";
  const removalIndex = source.indexOf(removalMarker);
  if (removalIndex < 0) throw new Error("Overlapping-mask removal anchor not found.");
  const reviewHelper = `  const reviewNextOverlappingAutoMask = () => {\n    const overlapCandidates = zones.filter((zone) => overlappingAutoMaskIds.has(zone.id));\n    if (overlapCandidates.length === 0) return;\n    const currentIndex = selectedZoneId === null\n      ? -1\n      : overlapCandidates.findIndex((zone) => zone.id === selectedZoneId);\n    const nextCandidate = overlapCandidates[(currentIndex + 1) % overlapCandidates.length];\n    setSelectedZoneId(nextCandidate.id);\n    setDetectMessage(\`Reviewing overlap candidate \${currentIndex + 2 > overlapCandidates.length ? 1 : currentIndex + 2} of \${overlapCandidates.length}.\`);\n  };\n\n`;
  source = source.slice(0, removalIndex) + reviewHelper + source.slice(removalIndex);
}

const reviewButton = `              <button type="button" onClick={reviewNextOverlappingAutoMask} disabled={overlappingAutoMaskIds.size === 0} aria-label="Select the next automatic mask that would be removed as an overlap">\n                Review Overlaps ({overlappingAutoMaskIds.size})\n              </button>\n`;
const button = `              <button type="button" onClick={removeOverlappingAutoMasks} disabled={overlappingAutoMaskIds.size === 0} aria-label="Remove heavily overlapping automatic masks and keep the strongest candidate">\n                Remove Overlaps ({overlappingAutoMaskIds.size})\n              </button>\n`;

if (!source.includes("Remove Overlaps ({overlappingAutoMaskIds.size})")) {
  const disableButton = source.indexOf("Disable All Auto Masks");
  if (disableButton < 0) throw new Error("Automatic-mask bulk button anchor not found.");
  const buttonEnd = source.indexOf("</button>", disableButton);
  if (buttonEnd < 0) throw new Error("Automatic-mask bulk button end not found.");
  const insertionIndex = buttonEnd + "</button>".length;
  source = source.slice(0, insertionIndex) + "\n" + reviewButton.trimEnd() + "\n" + button.trimEnd() + source.slice(insertionIndex);
} else if (!source.includes("Review Overlaps ({overlappingAutoMaskIds.size})")) {
  const removeButton = source.indexOf("Remove Overlaps ({overlappingAutoMaskIds.size})");
  const buttonStart = source.lastIndexOf("<button", removeButton);
  if (buttonStart < 0) throw new Error("Overlapping-mask remove button start not found.");
  source = source.slice(0, buttonStart) + reviewButton + source.slice(buttonStart);
}

await fs.writeFile(path, source);
await import("./patch-ui-overlap-candidate-warning-v1.mjs");
console.log("Applied overlapping automatic-mask cleanup, review actions, and keep/remove tracking.");