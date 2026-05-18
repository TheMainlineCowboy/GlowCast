import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

if (!source.includes("const [showSetupLayers, setShowSetupLayers]")) {
  source = source.replace(
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showSetupLayers, setShowSetupLayers] = useState(true);\n  const [nightPreview, setNightPreview] = useState(false);"
  );
}

source = source.replace('<main className="projectorMode" >', '<main className={`projectorMode ${nightPreview ? "nightPreview" : ""}`} >');
source = source.replace('<div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>', '<div className={`stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview ? "nightPreview" : ""}`}>');
source = source.replace('className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""}`}', 'className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""} ${!showSetupLayers ? "hideSetupLayers" : ""} ${nightPreview ? "nightPreviewSurface" : ""}`}');

source = source.replaceAll("showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replaceAll("!projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replaceAll("showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replace("projectionArea && showSurfaceHandles && showSetupLayers", "projectionArea && showSetupLayers && showSurfaceHandles");

const contentControls = `
            <button type="button" onClick={() => setShowSetupLayers((current) => !current)} disabled={!imageUrl} className={!showSetupLayers ? "activeEffect" : ""} >
              {showSetupLayers ? "Hide Setup Layers" : "Show Setup Layers"}
            </button>
            <button type="button" onClick={() => setNightPreview((current) => !current)} disabled={!imageUrl} className={nightPreview ? "activeEffect" : ""} >
              {nightPreview ? "Day Preview" : "Night Preview"}
            </button>`;

if (!source.includes("Night Preview")) {
  const target = `            <button className="primary" onClick={() => setProjectionOnly((value) => !value)} >
              {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
              {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
            </button>`;
  source = source.replace(target, target + contentControls);
}

if (!source.includes("Mask page preview controls")) {
  const addZoneButton = `              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode} >
                <Plus size={18} /> Add {drawShape} Zone
              </button>`;
  const maskControls = `
              {/* Mask page preview controls */}
              <button type="button" onClick={() => setShowSetupLayers((current) => !current)} disabled={!imageUrl} className={!showSetupLayers ? "activeEffect" : ""} >
                {showSetupLayers ? "Hide Setup Layers" : "Show Setup Layers"}
              </button>
              <button type="button" onClick={() => setNightPreview((current) => !current)} disabled={!imageUrl} className={nightPreview ? "activeEffect" : ""} >
                {nightPreview ? "Day Preview" : "Night Preview"}
              </button>`;
  source = source.replace(addZoneButton, addZoneButton + maskControls);
}

writeFileSync(appPath, source);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
const previewCss = `

/* Preview controls patch */
.resizeHandle,.surfacePointHandle{width:12px!important;height:12px!important;min-width:12px!important;min-height:12px!important;border-width:2px!important;}
@media (pointer:coarse){.resizeHandle,.surfacePointHandle{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;}}
.surfaceLayer.hideSetupLayers .zone,.surfaceLayer.hideSetupLayers .draftZone,.surfaceLayer.hideSetupLayers .projectionBoundary,.surfaceLayer.hideSetupLayers .edgeOverlay,.surfaceLayer.hideSetupLayers .surfacePolygonOverlay,.surfaceLayer.hideSetupLayers .surfacePointHandle,.surfaceLayer.hideSetupLayers .resizeHandle{display:none!important;visibility:hidden!important;pointer-events:none!important;}
.stage.nightPreview,.projectorMode.nightPreview{background:radial-gradient(circle at 50% 30%,#0b1630 0%,#030713 58%,#01030a 100%)!important;}
.stage.nightPreview .surfaceLayer,.projectorMode.nightPreview .projectorCanvas{background:#020617!important;box-shadow:inset 0 0 160px rgba(0,0,0,.82),0 0 45px rgba(29,78,216,.18)!important;}
.surfaceLayer.nightPreviewSurface::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(4,12,31,.52),rgba(0,0,0,.78)),radial-gradient(circle at 50% 28%,rgba(30,64,175,.2),rgba(0,0,0,.62) 62%,rgba(0,0,0,.9));mix-blend-mode:multiply;}
.surfaceLayer.nightPreviewSurface::after{content:"";position:absolute;inset:0;z-index:12;pointer-events:none;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.08),rgba(255,255,255,0) 38%),radial-gradient(circle at 50% 50%,rgba(59,130,246,.10),rgba(0,0,0,.42) 76%);mix-blend-mode:screen;}
.surfaceLayer.nightPreviewSurface .referencePhoto,.surfaceLayer.nightPreviewSurface .maskCutout{filter:brightness(.34) contrast(1.22) saturate(.58) hue-rotate(185deg)!important;}
.stage.nightPreview .projectionSurface,.stage.nightPreview .zoneProjection,.projectorMode.nightPreview .projectionSurface,.projectorMode.nightPreview .zoneProjection{filter:brightness(1.35) saturate(1.18) drop-shadow(0 0 12px rgba(255,255,255,.28)) drop-shadow(0 0 26px rgba(96,165,250,.18))!important;z-index:6;}
.stage.nightPreview .snowCanvasLayer,.projectorMode.nightPreview .snowCanvasLayer{filter:brightness(1.22) drop-shadow(0 0 8px rgba(255,255,255,.28))!important;z-index:11;}
`;

if (css.includes("/* Preview controls patch */")) {
  css = css.replace(/\n\/\* Preview controls patch \*\/[\s\S]*$/m, previewCss);
} else {
  css += previewCss;
}
writeFileSync(cssPath, css);
