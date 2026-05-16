import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const flatStart = '      {step === "flat" && (';
const contentStart = '      {step === "content" && (';
const start = text.indexOf(flatStart);
const end = text.indexOf(contentStart);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Flat View block not found. Make sure patch-flat-view-shell runs before patch-flat-select-v1.");
}

const flatBlock = `      {step === "flat" && (
        <section className="workspace flatViewShell">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Flat View</h2>
              <button type="button" onClick={generateFlattenedSurfacePreview} disabled={!imageUrl || surfacePolygonPoints.length < 4}>Refresh Flat View</button>
              <button type="button" onClick={() => setStep("start")}>Back to Surface Setup</button>
              <button type="button" onClick={() => setStep("mask")}>Back to Mask Tools</button>
              {selectedZone ? (
                <div className="flatSelectionBox">
                  <strong>Selected Mask {zones.findIndex((zone) => zone.id === selectedZone.id) + 1}</strong>
                  <span>{selectedZone.shape ?? "rectangle"}</span>
                  <button type="button" onClick={() => { setSelectedTarget("zone"); setSelectedZoneId(selectedZone.id); setStep("mask"); }}>Edit This Mask on Page 2</button>
                </div>
              ) : (
                <p className="helperText">Tap a mask overlay to select it.</p>
              )}
            </div>
          </aside>
          <div className="flattenPreviewPanel flatViewPanel">
            {flattenedSurfaceUrl ? (
              <div className="flattenPreviewStage flatViewStage">
                <img src={flattenedSurfaceUrl} alt="Flattened surface" />
                {flattenedPreviewZones.map((zone, index) => (
                  <button type="button" key={zone.id + "-flat-view-" + index} className={"flattenPreviewMask flatPreviewSelectable " + shapeClass(zone.shape) + (selectedZoneId === zone.id ? " selectedFlatMask" : "")} style={toStyle(zone)} onClick={() => { setSelectedTarget("zone"); setSelectedZoneId(zone.id); }}>
                    <span>{index + 1}</span>
                  </button>
                ))}
              </div>
            ) : <div className="flattenPreviewEmpty">Generate a flattened preview first.</div>}
            <p className="helperText">{flattenedSurfaceMessage}</p>
          </div>
        </section>
      )}

`;

text = text.slice(0, start) + flatBlock + text.slice(end);
writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes("flatPreviewSelectable")) {
  css += `
.flatPreviewSelectable{pointer-events:auto!important;cursor:pointer!important;padding:0!important;margin:0!important;color:#020617!important;font:inherit!important;text-align:left!important;appearance:none!important}.flatPreviewSelectable span{pointer-events:none!important}.selectedFlatMask{border-color:#67e8f9!important;box-shadow:0 0 0 3px rgba(103,232,249,.55),0 0 24px rgba(103,232,249,.5)!important}.flatSelectionBox{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(103,232,249,.35);border-radius:14px;background:rgba(2,6,23,.45)}.flatSelectionBox span{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
`;
}
writeFileSync(cssPath, css);
