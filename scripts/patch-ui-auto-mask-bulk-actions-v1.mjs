import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const bulkActionMarker = "const setAllAutoMasksIncluded = (included: boolean) => {";
const bulkAction = `  const setAllAutoMasksIncluded = (included: boolean) => {\n    setZones((currentZones) => currentZones.map((zone) =>\n      ${autoMaskCheck} ? { ...zone, included } : zone\n    ));\n  };\n`;

if (!source.includes(bulkActionMarker)) {
  const includedZonesIndex = source.indexOf("const includedZones = zones.filter((zone) => zone.included);");
  if (includedZonesIndex < 0) throw new Error("Mask-state insertion point not found.");
  const insertionIndex = source.indexOf("\n", includedZonesIndex) + 1;
  source = source.slice(0, insertionIndex) + bulkAction + source.slice(insertionIndex);
}

const bulkButtons = `              <button type="button" onClick={() => setAllAutoMasksIncluded(true)} disabled={!zones.some((zone) => ${autoMaskCheck} && !zone.included)} aria-label="Enable every automatic mask">\n                Enable All Auto Masks\n              </button>\n              <button type="button" onClick={() => setAllAutoMasksIncluded(false)} disabled={!zones.some((zone) => ${autoMaskCheck} && zone.included)} aria-label="Disable every automatic mask">\n                Disable All Auto Masks\n              </button>\n`;

if (!source.includes("Enable All Auto Masks")) {
  const drawModeIndex = source.indexOf("setDrawMode((value) => !value)");
  const buttonIndex = source.lastIndexOf("<button", drawModeIndex);
  if (drawModeIndex < 0 || buttonIndex < 0) throw new Error("Mask toolbar insertion point not found.");
  source = source.slice(0, buttonIndex) + bulkButtons.trimStart() + source.slice(buttonIndex);
}

await fs.writeFile(path, source);
console.log("Applied automatic-mask bulk review actions source patch.");
