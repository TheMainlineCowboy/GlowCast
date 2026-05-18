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

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const tapImport = 'import { createTapMaskZone } from "./manualMaskTapFix";\n';
if (!text.includes(tapImport)) {
  if (!text.includes(edgeImport)) throw new Error("Could not find edgeDetect import anchor.");
  text = text.replace(edgeImport, edgeImport + tapImport);
}

const oldFinish = `  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);
    if (rect.width < 2 || rect.height < 2) return;
    const id = Date.now();
    setZones((current) => [
      ...current,
      { id, ...rect, included: true, label: \`manual \${draftZone.shape} avoid zone\` }
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
  }
`;

const newFinish = `  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    const zone = rect.width < 2 || rect.height < 2
      ? createTapMaskZone(draftZone.startX, draftZone.startY, draftZone.shape)
      : rect;
    setDraftZone(null);
    const id = Date.now();
    setZones((current) => [
      ...current,
      { id, ...zone, included: true, label: \`manual \${draftZone.shape} avoid zone\` }
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
  }
`;

if (!text.includes("createTapMaskZone(draftZone.startX")) {
  if (!text.includes(oldFinish)) throw new Error("Could not find finishPointerAction block.");
  text = text.replace(oldFinish, newFinish);
}

text = text.replace(
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n    setCornerMode(false);',
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(true);\n    setCornerMode(false);'
);

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
