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

const start = text.indexOf("  function finishPointerAction()");
const end = text.indexOf("\n\n  async function openProjectorMode", start);
if (start === -1 || end === -1) throw new Error("Could not locate finishPointerAction block.");
let finishBlock = text.slice(start, end);
if (!finishBlock.includes("setSelectedZoneId(id);")) throw new Error("finishPointerAction missing setSelectedZoneId(id).");
finishBlock = finishBlock.replace("    if (!draftZone) return;", "    if (!draftZone) { setDrawMode(false); return; }");
finishBlock = finishBlock.replace("    if (rect.width < 2 || rect.height < 2) return;", "    if (rect.width < 2 || rect.height < 2) { setDrawMode(false); return; }");
if (!finishBlock.includes("setSelectedZoneId(id);\n    setDrawMode(false);")) {
  finishBlock = finishBlock.replace("    setSelectedZoneId(id);", "    setSelectedZoneId(id);\n    setDrawMode(false);");
}
if (!finishBlock.includes("setDrawMode(false);")) throw new Error("One-shot draw mode patch failed verification.");
text = text.slice(0, start) + finishBlock + text.slice(end);

if (!text.includes("ONE_SHOT_DRAW_FINAL")) text = "/* ONE_SHOT_DRAW_FINAL */\n" + text;

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
