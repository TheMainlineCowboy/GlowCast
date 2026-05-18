import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

if (!source.includes("const [showSetupLayers, setShowSetupLayers]")) {
  source = source.replace(
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showSetupLayers, setShowSetupLayers] = useState(true);\n  const [nightPreview, setNightPreview] = useState(false);\n  const [snowSettings, setSnowSettings] = useState({ density: 50, speed: 50, accumulation: 50, wind: 50 });"
  );
} else if (!source.includes("const [snowSettings, setSnowSettings]")) {
  source = source.replace(
    "const [nightPreview, setNightPreview] = useState(false);",
    "const [nightPreview, setNightPreview] = useState(false);\n  const [snowSettings, setSnowSettings] = useState({ density: 50, speed: 50, accumulation: 50, wind: 50 });"
  );
}

source = source.replace('<main className="projectorMode" >', '<main className={`projectorMode ${nightPreview ? "nightPreview" : ""}`} >');
source = source.replace('<div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>', '<div className={`stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview ? "nightPreview" : ""}`}>');
source = source.replace('className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""}`}', 'className={`surfaceLayer ${drawMode ? "drawMode" : ""} ${surfacePolygonMode ? "polygonMode" : ""} ${!showSetupLayers ? "hideSetupLayers" : ""} ${nightPreview ? "nightPreviewSurface" : ""}`}');
source = source.replace('<CanvasSnowLayer ledges={zones} />', '<CanvasSnowLayer ledges={zones} settings={snowSettings} />');

source = source.replaceAll("showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replaceAll("!projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replaceAll("showSetupLayers && showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode", "showSetupLayers && !projectionOnly && !cornerMode && !surfacePolygonMode");
source = source.replace("projectionArea && showSurfaceHandles && showSetupLayers", "projectionArea && showSetupLayers && showSurfaceHandles");

const largeLayers = `
              <button type="button" onClick={() => setShowSetupLayers((current) => !current)} disabled={!imageUrl} className={!showSetupLayers ? "activeEffect" : ""}>
                {showSetupLayers ? "Hide Setup Layers" : "Show Setup Layers"}
              </button>`;
const largeNight = `
              <button type="button" onClick={() => setNightPreview((current) => !current)} disabled={!imageUrl} className={nightPreview ? "activeEffect" : ""}>
                {nightPreview ? "Day Preview" : "Night Preview"}
              </button>`;
source = source.replaceAll(largeLayers, "");
source = source.replaceAll(largeNight, "");

if (!source.includes("stagePreviewControls")) {
  const stageOpen = '    <div className={`stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview ? "nightPreview" : ""}`}> ';
  const stageOpenAlt = '    <div className={`stage ${projectionOnly ? "projectionOnly" : ""} ${nightPreview ? "nightPreview" : ""}`}>';
  const controls = `
      {(step === "mask" || step === "content") && imageUrl && (
        <div className="stagePreviewControls">
          <button type="button" onClick={() => setShowSetupLayers((current) => !current)} className={!showSetupLayers ? "activeEffect" : ""}>
            {showSetupLayers ? "Layers" : "Layers Off"}
          </button>
          <button type="button" onClick={() => setNightPreview((current) => !current)} className={nightPreview ? "activeEffect" : ""}>
            {nightPreview ? "Day" : "Night"}
          </button>
        </div>
      )}`;
  if (source.includes(stageOpenAlt)) {
    source = source.replace(stageOpenAlt, stageOpenAlt + controls);
  } else {
    source = source.replace(stageOpen, stageOpen + controls);
  }
}

if (!source.includes("snowControlPanel")) {
  const anchor = `            <div className="panelBlock">
              <h2>Built-in Effects</h2>`;
  const panel = `            {activeEffect === "snow" && (
              <div className="panelBlock snowControlPanel">
                <h2>Snow Controls</h2>
                {([
                  ["density", "Density"],
                  ["speed", "Fall Speed"],
                  ["accumulation", "Accumulation"],
                  ["wind", "Wind / Drift"]
                ] as const).map(([key, label]) => (
                  <label key={key} className="snowSliderLabel">
                    <span>{label}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={snowSettings[key]}
                      onChange={(event) => setSnowSettings((current) => ({ ...current, [key]: Number(event.target.value) }))}
                    />
                    <small>{snowSettings[key]}</small>
                  </label>
                ))}
              </div>
            )}
`;
  source = source.replace(anchor, panel + anchor);
}

writeFileSync(appPath, source);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
const previewCss = `

/* Preview controls patch */
.resizeHandle,.surfacePointHandle{width:12px!important;height:12px!important;min-width:12px!important;min-height:12px!important;border-width:2px!important;}
@media (pointer:coarse){.resizeHandle,.surfacePointHandle{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;}}
.stagePreviewControls{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin:0 0 8px 0;position:relative;z-index:30;}
.stagePreviewControls button{padding:6px 10px!important;min-height:0!important;border-radius:999px!important;font-size:12px!important;line-height:1!important;background:rgba(15,23,42,.82)!important;border:1px solid rgba(148,163,184,.45)!important;color:#e5e7eb!important;box-shadow:0 8px 24px rgba(0,0,0,.22)!important;}
.stagePreviewControls button.activeEffect{background:rgba(37,99,235,.92)!important;border-color:rgba(191,219,254,.75)!important;color:white!important;}
.snowControlPanel{gap:10px!important;}
.snowSliderLabel{display:grid!important;grid-template-columns:1fr auto!important;gap:6px 10px!important;align-items:center!important;font-size:12px!important;color:#cbd5e1!important;}
.snowSliderLabel input{grid-column:1 / -1!important;width:100%!important;accent-color:#60a5fa!important;}
.snowSliderLabel small{font-variant-numeric:tabular-nums!important;color:#94a3b8!important;}
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
