import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const helperMarker = "  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {";
const helper = `  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {\n    const autoMasks = candidateZones.filter((zone) => ${autoMaskCheck});\n    const duplicateIds = new Set<number>();\n    for (let index = 0; index < autoMasks.length; index += 1) {\n      const first = autoMasks[index];\n      if (duplicateIds.has(first.id)) continue;\n      for (let compareIndex = index + 1; compareIndex < autoMasks.length; compareIndex += 1) {\n        const second = autoMasks[compareIndex];\n        if (duplicateIds.has(second.id)) continue;\n        const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));\n        const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));\n        const overlapArea = overlapWidth * overlapHeight;\n        if (overlapArea <= 0) continue;\n        const firstArea = Math.max(0.0001, first.width * first.height);\n        const secondArea = Math.max(0.0001, second.width * second.height);\n        const unionArea = firstArea + secondArea - overlapArea;\n        const intersectionOverUnion = overlapArea / unionArea;\n        const smallerCoverage = overlapArea / Math.min(firstArea, secondArea);\n        if (intersectionOverUnion >= 0.82 || smallerCoverage >= 0.94) {\n          const firstPriority = (first.included ? 2 : 0) + firstArea / 10000;\n          const secondPriority = (second.included ? 2 : 0) + secondArea / 10000;\n          duplicateIds.add(firstPriority >= secondPriority ? second.id : first.id);\n        }\n      }\n    }\n    return duplicateIds;\n  };\n\n  const overlappingAutoMaskIds = findOverlappingAutoMaskIds(zones);\n\n  const removeOverlappingAutoMasks = () => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    setZones((currentZones) => currentZones.filter((zone) => !overlappingAutoMaskIds.has(zone.id)));\n    if (selectedZoneId !== null && overlappingAutoMaskIds.has(selectedZoneId)) setSelectedZoneId(null);\n    setDetectMessage(\`Removed \${overlappingAutoMaskIds.size} overlapping automatic mask\${overlappingAutoMaskIds.size === 1 ? "" : "s"}.\`);\n  };\n`;

if (!source.includes(helperMarker)) {
  const bulkActionStart = source.indexOf("  const setAllAutoMasksIncluded = (included: boolean) => {");
  if (bulkActionStart < 0) throw new Error("Automatic-mask bulk action anchor not found.");
  const bulkActionEnd = source.indexOf("\n  };", bulkActionStart);
  if (bulkActionEnd < 0) throw new Error("Automatic-mask bulk action end not found.");
  const insertionIndex = bulkActionEnd + "\n  };".length;
  source = source.slice(0, insertionIndex) + "\n\n" + helper + source.slice(insertionIndex);
}

const button = `              <button type="button" onClick={removeOverlappingAutoMasks} disabled={overlappingAutoMaskIds.size === 0} aria-label="Remove heavily overlapping automatic masks and keep the strongest candidate">\n                Remove Overlaps ({overlappingAutoMaskIds.size})\n              </button>\n`;

if (!source.includes("Remove Overlaps ({overlappingAutoMaskIds.size})")) {
  const disableButton = source.indexOf("Disable All Auto Masks");
  if (disableButton < 0) throw new Error("Automatic-mask bulk button anchor not found.");
  const buttonEnd = source.indexOf("</button>", disableButton);
  if (buttonEnd < 0) throw new Error("Automatic-mask bulk button end not found.");
  const insertionIndex = buttonEnd + "</button>".length;
  source = source.slice(0, insertionIndex) + "\n" + button.trimEnd() + source.slice(insertionIndex);
}

await fs.writeFile(path, source);
console.log("Applied overlapping automatic-mask cleanup action.");
