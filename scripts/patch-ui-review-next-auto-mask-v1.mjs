import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const functionMarker = "const reviewNextDisabledAutoMask = () => {";
const reviewFunction = `  const reviewNextDisabledAutoMask = () => {\n    const disabledAutoMasks = zones.filter((zone) => ${autoMaskCheck} && !zone.included);\n    if (!disabledAutoMasks.length) return;\n    const currentIndex = disabledAutoMasks.findIndex((zone) => zone.id === selectedZoneId);\n    const nextMask = disabledAutoMasks[(currentIndex + 1) % disabledAutoMasks.length];\n    setSelectedTarget("zone");\n    setSelectedZoneId(nextMask.id);\n    setDrawMode(false);\n    setProjectionOnly(false);\n  };\n`;

if (!source.includes(functionMarker)) {
  const includedZonesMarker = "const includedZones = zones.filter((zone) => zone.included);";
  const markerIndex = source.indexOf(includedZonesMarker);
  if (markerIndex < 0) throw new Error("Included-zone state anchor not found.");
  const insertionIndex = source.indexOf("\n", markerIndex) + 1;
  source = source.slice(0, insertionIndex) + reviewFunction + source.slice(insertionIndex);
}

const buttonLabel = "Review Next Auto Mask";
if (!source.includes(buttonLabel)) {
  const bulkButtonMarker = '<button type="button" onClick={() => setAllAutoMasksIncluded(true)}';
  const buttonIndex = source.indexOf(bulkButtonMarker);
  if (buttonIndex < 0) throw new Error("Automatic-mask bulk action anchor not found.");
  const reviewButton = `              <button type="button" onClick={reviewNextDisabledAutoMask} disabled={!zones.some((zone) => ${autoMaskCheck} && !zone.included)} aria-label="Select the next disabled automatic mask for review">\n                ${buttonLabel}\n              </button>\n`;
  source = source.slice(0, buttonIndex) + reviewButton.trimStart() + source.slice(buttonIndex);
}

await fs.writeFile(path, source);
console.log("Applied next automatic-mask review action source patch.");
