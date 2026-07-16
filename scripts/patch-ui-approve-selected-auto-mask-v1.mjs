import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const functionMarker = "const approveSelectedAutoMask = () => {";
const approveFunction = `  const approveSelectedAutoMask = () => {\n    const disabledAutoMasks = zones.filter((zone) => ${autoMaskCheck} && !zone.included);\n    const selectedIndex = disabledAutoMasks.findIndex((zone) => zone.id === selectedZoneId);\n    const selectedAutoMask = disabledAutoMasks[selectedIndex];\n    if (!selectedAutoMask) return;\n    const remainingAutoMasks = disabledAutoMasks.filter((zone) => zone.id !== selectedAutoMask.id);\n    const nextAutoMask = remainingAutoMasks.length > 0\n      ? remainingAutoMasks[Math.min(selectedIndex, remainingAutoMasks.length - 1)]\n      : undefined;\n    setZones((currentZones) => currentZones.map((zone) =>\n      zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone\n    ));\n    setSelectedZoneId(nextAutoMask?.id ?? null);\n  };\n`;

const existingFunctionStart = source.indexOf(functionMarker);
if (existingFunctionStart >= 0) {
  const existingFunctionEnd = source.indexOf("\n  };", existingFunctionStart);
  if (existingFunctionEnd < 0) throw new Error("Reviewed-mask approval function end not found.");
  source = source.slice(0, existingFunctionStart) + approveFunction.trimStart() + source.slice(existingFunctionEnd + 5);
} else {
  const reviewFunctionMarker = "const reviewNextDisabledAutoMask = () => {";
  const markerIndex = source.indexOf(reviewFunctionMarker);
  if (markerIndex < 0) throw new Error("Review-next action anchor not found.");
  source = source.slice(0, markerIndex) + approveFunction.trimStart() + source.slice(markerIndex);
}

source = source.replace("Enable Reviewed Auto Mask", "Enable & Review Next Auto Mask");
source = source.replace(
  'aria-label="Enable the selected automatic mask after review"',
  'aria-label="Enable the selected automatic mask and review the next disabled automatic mask"'
);

const oldButtonBody = `                Enable & Review Next Auto Mask\n`;
const countedButtonBody = `                {zones.some((zone) => ${autoMaskCheck} && !zone.included)\n                  ? \`Enable & Review Next Auto Mask (\${zones.filter((zone) => ${autoMaskCheck} && !zone.included).length} remaining)\`\n                  : "Enable & Review Next Auto Mask"}\n`;

if (source.includes("Enable & Review Next Auto Mask (") && source.includes("remaining)")) {
  console.log("Approve-and-advance remaining count already present.");
} else if (source.includes(oldButtonBody)) {
  source = source.replace(oldButtonBody, countedButtonBody);
} else if (!source.includes("Enable & Review Next Auto Mask")) {
  const reviewButtonMarker = '<button type="button" onClick={reviewNextDisabledAutoMask}';
  const buttonIndex = source.indexOf(reviewButtonMarker);
  if (buttonIndex < 0) throw new Error("Review-next button anchor not found.");
  const approveButton = `              <button type="button" onClick={approveSelectedAutoMask} disabled={!zones.some((zone) => zone.id === selectedZoneId && ${autoMaskCheck} && !zone.included)} aria-label="Enable the selected automatic mask and review the next disabled automatic mask">\n${countedButtonBody}              </button>\n`;
  source = source.slice(0, buttonIndex) + approveButton.trimStart() + source.slice(buttonIndex);
}

await fs.writeFile(path, source);
console.log("Applied selected automatic-mask approve-and-advance source patch with remaining count.");