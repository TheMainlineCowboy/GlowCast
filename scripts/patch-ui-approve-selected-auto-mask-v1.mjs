import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const functionMarker = "const approveSelectedAutoMask = () => {";
const approveFunction = `  const approveSelectedAutoMask = () => {\n    const selectedAutoMask = zones.find((zone) => zone.id === selectedZoneId && ${autoMaskCheck} && !zone.included);\n    if (!selectedAutoMask) return;\n    setZones((currentZones) => currentZones.map((zone) =>\n      zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone\n    ));\n  };\n`;

if (!source.includes(functionMarker)) {
  const reviewFunctionMarker = "const reviewNextDisabledAutoMask = () => {";
  const markerIndex = source.indexOf(reviewFunctionMarker);
  if (markerIndex < 0) throw new Error("Review-next action anchor not found.");
  source = source.slice(0, markerIndex) + approveFunction.trimStart() + source.slice(markerIndex);
}

const buttonLabel = "Enable Reviewed Auto Mask";
if (!source.includes(buttonLabel)) {
  const reviewButtonMarker = '<button type="button" onClick={reviewNextDisabledAutoMask}';
  const buttonIndex = source.indexOf(reviewButtonMarker);
  if (buttonIndex < 0) throw new Error("Review-next button anchor not found.");
  const approveButton = `              <button type="button" onClick={approveSelectedAutoMask} disabled={!zones.some((zone) => zone.id === selectedZoneId && ${autoMaskCheck} && !zone.included)} aria-label="Enable the selected automatic mask after review">\n                ${buttonLabel}\n              </button>\n`;
  source = source.slice(0, buttonIndex) + approveButton.trimStart() + source.slice(buttonIndex);
}

await fs.writeFile(path, source);
console.log("Applied selected automatic-mask approval source patch.");
