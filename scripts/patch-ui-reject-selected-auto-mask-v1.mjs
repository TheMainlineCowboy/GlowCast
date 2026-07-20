import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const functionMarker = "const rejectSelectedAutoMask = () => {";
const rejectFunction = `  const rejectSelectedAutoMask = () => {\n    const reviewableAutoMasks = zones.filter((zone) => ${autoMaskCheck} && !zone.included);\n    const selectedIndex = reviewableAutoMasks.findIndex((zone) => zone.id === selectedZoneId);\n    const selectedAutoMask = reviewableAutoMasks[selectedIndex];\n    if (!selectedAutoMask) return;\n    const remainingAutoMasks = reviewableAutoMasks.filter((zone) => zone.id !== selectedAutoMask.id);\n    const nextAutoMask = remainingAutoMasks.length > 0\n      ? remainingAutoMasks[Math.min(selectedIndex, remainingAutoMasks.length - 1)]\n      : undefined;\n    setZones((currentZones) => currentZones.filter((zone) => zone.id !== selectedAutoMask.id));\n    setSelectedZoneId(nextAutoMask?.id ?? null);\n    setDetectMessage(nextAutoMask\n      ? \`Rejected automatic mask. \${remainingAutoMasks.length} remaining to review.\`\n      : "Rejected automatic mask. Review complete.");\n  };\n`;

if (!source.includes(functionMarker)) {
  const approveMarker = "const approveSelectedAutoMask = () => {";
  const markerIndex = source.indexOf(approveMarker);
  if (markerIndex < 0) throw new Error("Approve-and-advance action anchor not found.");
  source = source.slice(0, markerIndex) + rejectFunction.trimStart() + source.slice(markerIndex);
}

if (!source.includes("Reject & Review Next Auto Mask")) {
  const approveButtonMarker = '<button type="button" onClick={approveSelectedAutoMask}';
  const buttonIndex = source.indexOf(approveButtonMarker);
  if (buttonIndex < 0) throw new Error("Approve-and-advance button anchor not found.");
  const rejectButton = `              <button type="button" onClick={rejectSelectedAutoMask} disabled={!zones.some((zone) => zone.id === selectedZoneId && ${autoMaskCheck} && !zone.included)} aria-label="Delete the selected automatic mask and review the next disabled automatic mask">\n                Reject & Review Next Auto Mask\n              </button>\n`;
  source = source.slice(0, buttonIndex) + rejectButton.trimStart() + source.slice(buttonIndex);
}

await fs.writeFile(path, source);
console.log("Applied selected automatic-mask reject-and-advance source patch.");
