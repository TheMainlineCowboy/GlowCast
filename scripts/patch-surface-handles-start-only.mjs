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

text = text.replace(
  'import { createTapMaskZone } from "./manualMaskTapFix";\n',
  ''
);

text = text.replace(
  /    const rect = normalizeDraftZone\(draftZone\);\n    const zone = rect\.width < 2 \|\| rect\.height < 2\n      \? createTapMaskZone\(draftZone\.startX, draftZone\.startY, draftZone\.shape\)\n      : rect;\n    setDraftZone\(null\);\n    const id = Date\.now\(\);\n    setZones\(\(current\) => \[\n      \.\.\.current,\n      \{ id, \.\.\.zone, included: true, label: `manual \$\{draftZone\.shape\} avoid zone` \}\n    \]\);/g,
  '    const rect = normalizeDraftZone(draftZone);\n    setDraftZone(null);\n    if (rect.width < 2 || rect.height < 2) return;\n    const id = Date.now();\n    setZones((current) => [\n      ...current,\n      { id, ...rect, included: true, label: `manual ${draftZone.shape} avoid zone` }\n    ]);'
);

text = text.replace(
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(true);\n    setCornerMode(false);',
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n    setCornerMode(false);'
);

text = text.replace(
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n  }\n\n  async function openProjectorMode()',
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n  }\n\n  async function openProjectorMode()'
);

text = text.replace(
  `    if (
      !imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone,.projectionBoundary")
    ) {
      return;
    }
    const point = getPoint(event);`,
  `    const clickedEditable = (event.target as HTMLElement).closest(".zone,.projectionBoundary,.resizeHandle");
    if (!imageUrl || projectionOnly || clickedEditable) {
      return;
    }
    if (!drawMode) {
      setSelectedTarget("zone");
      setSelectedZoneId(null);
      setDraftZone(null);
      return;
    }
    const point = getPoint(event);`
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
