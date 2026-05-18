import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

if (!source.includes("const [showSetupLayers, setShowSetupLayers]")) {
  source = source.replace(
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showSetupLayers, setShowSetupLayers] = useState(true);\n  const [nightPreview, setNightPreview] = useState(false);"
  );
}

if (!source.includes('projectorMode ${nightPreview ? "nightPreview"')) {
  source = source.replace(
    '<main className="projectorMode" >',
    '<main className={`projectorMode ${nightPreview ? "nightPreview" : ""}`} >'
  );
}

if (!source.includes('stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview')) {
  source = source.replace(
    '<div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>',
    '<div className={`stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview ? "nightPreview" : ""}`}>'
  );
}

if (!source.includes('hideSetupLayers')) {
  source = source.replace(
    'className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""}`}',
    'className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""} ${!showSetupLayers ? "hideSetupLayers" : ""} ${nightPreview ? "nightPreviewSurface" : ""}`}'
  );
}

source = source.replaceAll(
  "showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode",
  "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode"
);
source = source.replaceAll(
  "!projectionOnly && !cornerMode && !surfacePolygonMode",
  "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode"
);
source = source.replaceAll(
  "showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode",
  "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode"
);
source = source.replace(
  "projectionArea && showSurfaceHandles && showSetupLayers",
  "projectionArea && showSetupLayers && showSurfaceHandles"
);

if (!source.includes("Night Preview")) {
  source = source.replace(
    '{showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}\n              </button>',
    '{showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}\n              </button>\n              <button type="button" onClick={() => setShowSetupLayers((current) => !current)} disabled={!imageUrl} className={!showSetupLayers ? "activeEffect" : ""} >\n                {showSetupLayers ? "Hide Setup Layers" : "Show Setup Layers"}\n              </button>\n              <button type="button" onClick={() => setNightPreview((current) => !current)} disabled={!imageUrl} className={nightPreview ? "activeEffect" : ""} >\n                {nightPreview ? "Day Preview" : "Night Preview"}\n              </button>'
  );
}

writeFileSync(appPath, source);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes("Preview controls patch")) {
  css += `

/* Preview controls patch */
.resizeHandle,.surfacePointHandle{width:12px!important;height:12px!important;min-width:12px!important;min-height:12px!important;border-width:2px!important;}
@media (pointer:coarse){.resizeHandle,.surfacePointHandle{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;}}
.surfaceLayer.hideSetupLayers .zone,.surfaceLayer.hideSetupLayers .draftZone,.surfaceLayer.hideSetupLayers .projectionBoundary,.surfaceLayer.hideSetupLayers .edgeOverlay,.surfaceLayer.hideSetupLayers .surfacePolygonOverlay,.surfaceLayer.hideSetupLayers .surfacePointHandle,.surfaceLayer.hideSetupLayers .resizeHandle{display:none!important;visibility:hidden!important;pointer-events:none!important;}
.surfaceLayer.nightPreviewSurface .referencePhoto,.surfaceLayer.nightPreviewSurface .maskCutout{filter:brightness(.28) contrast(1.12) saturate(.72)!important;}
.projectorMode.nightPreview .projectorCanvas,.stage.nightPreview .surfaceLayer{background:#020617!important;}
.stage.nightPreview .projectionSurface,.stage.nightPreview .zoneProjection,.stage.nightPreview .snowCanvasLayer,.projectorMode.nightPreview .projectionSurface,.projectorMode.nightPreview .zoneProjection,.projectorMode.nightPreview .snowCanvasLayer{filter:none!important;}
`;
}
writeFileSync(cssPath, css);
