import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

text = text.replace(
  /\{(?:step === \"start\" && )*surfacePolygonClosed && !projectionOnly && surfacePolygonPoints\.map\(\(point, index\) => \(/g,
  '{step === "start" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => ('
);

text = text.replace(
  /\{(?:step === \"start\" && )*projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode \? \(/g,
  '{step === "start" && projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? ('
);

const finishStart = text.indexOf("  function finishPointerAction()");
const finishEnd = text.indexOf("\n\n  async function openProjectorMode", finishStart);
if (finishStart === -1 || finishEnd === -1) throw new Error("Could not locate finishPointerAction block.");
let finishBlock = text.slice(finishStart, finishEnd);
finishBlock = finishBlock.replace("    if (!draftZone) return;", "    if (!draftZone) { setDrawMode(false); return; }");
finishBlock = finishBlock.replace("    if (rect.width < 2 || rect.height < 2) return;", "    if (rect.width < 2 || rect.height < 2) { setDrawMode(false); return; }");
if (!finishBlock.includes("setSelectedZoneId(id);\n    setDrawMode(false);")) {
  finishBlock = finishBlock.replace("    setSelectedZoneId(id);", "    setSelectedZoneId(id);\n    setDrawMode(false);");
}
if (!finishBlock.includes("setDrawMode(false);")) throw new Error("Draw mode hard stop did not land.");
text = text.slice(0, finishStart) + finishBlock + text.slice(finishEnd);

if (!text.includes("DRAW_MODE_HARD_STOP_V2")) text = "/* DRAW_MODE_HARD_STOP_V2 */\n" + text;

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes("Mask page surface edit hard block")) {
  css += `
/* Mask page surface edit hard block */
.maskOnlyWorkspace .surfacePointHandle,
.maskOnlyWorkspace .projectionBoundary{display:none!important;pointer-events:none!important;visibility:hidden!important;}
.maskOnlyWorkspace .surfacePolygonOverlay circle{display:none!important;pointer-events:none!important;}
.maskOnlyWorkspace .surfacePolygonOverlay{pointer-events:none!important;}
`;
}
writeFileSync(cssPath, css);
