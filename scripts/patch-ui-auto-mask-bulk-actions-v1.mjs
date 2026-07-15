import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const visibleAnchor = `  const visibleSetupZones = showOnlyAutoMasks ? zones.filter((zone) => ${autoMaskCheck}) : zones;`;
const bulkAction = `  const setAllAutoMasksIncluded = (included: boolean) => {\n    setZones((currentZones) => currentZones.map((zone) =>\n      ${autoMaskCheck} ? { ...zone, included } : zone\n    ));\n  };`;

if (!source.includes(bulkAction)) {
  if (!source.includes(visibleAnchor)) throw new Error("Auto-mask review state anchor not found.");
  source = source.replace(visibleAnchor, `${visibleAnchor}\n${bulkAction}`);
}

const toolbarAnchor = '              <button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl} >';
const bulkButtons = `              <button type="button" onClick={() => setAllAutoMasksIncluded(true)} disabled={!zones.some((zone) => ${autoMaskCheck} && !zone.included)} aria-label="Enable every automatic mask">\n                Enable All Auto Masks\n              </button>\n              <button type="button" onClick={() => setAllAutoMasksIncluded(false)} disabled={!zones.some((zone) => ${autoMaskCheck} && zone.included)} aria-label="Disable every automatic mask">\n                Disable All Auto Masks\n              </button>\n`;

if (!source.includes("Enable All Auto Masks")) {
  if (!source.includes(toolbarAnchor)) throw new Error("Mask toolbar insertion anchor not found.");
  source = source.replace(toolbarAnchor, bulkButtons + toolbarAnchor);
}

await fs.writeFile(path, source);
console.log("Applied automatic-mask bulk review actions source patch.");
