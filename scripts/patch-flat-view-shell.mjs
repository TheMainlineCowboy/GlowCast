import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

text = text.replace(
  'type Step = "start" | "mask" | "content" | "export";',
  'type Step = "start" | "mask" | "flat" | "content" | "export";'
);

if (!text.includes('Open Flat View')) {
  text = text.replace(
    '<p className="helperText">{flattenedSurfaceMessage}</p>',
    '<button type="button" onClick={() => setStep("flat")} disabled={!flattenedSurfaceUrl}>Open Flat View</button>\n                <p className="helperText">{flattenedSurfaceMessage}</p>'
  );
}

if (!text.includes('{step === "flat" && (')) {
  const marker = '      {step === "content" && (';
  const flatBlock = `      {step === "flat" && (
        <section className="workspace flatViewShell">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Flat View</h2>
              <button type="button" onClick={generateFlattenedSurfacePreview} disabled={!imageUrl || surfacePolygonPoints.length < 4}>Refresh Flat View</button>
              <button type="button" onClick={() => setStep("start")}>Back to Surface Setup</button>
              <button type="button" onClick={() => setStep("mask")}>Back to Mask Tools</button>
              <p className="helperText">Read-only flattened surface view. Mask editing stays on Page 2 for now.</p>
            </div>
          </aside>
          <div className="flattenPreviewPanel flatViewPanel">
            {flattenedSurfaceUrl ? (
              <div className="flattenPreviewStage flatViewStage">
                <img src={flattenedSurfaceUrl} alt="Flattened surface" />
                {flattenedPreviewZones.map((zone, index) => (
                  <div key={zone.id + "-flat-view-" + index} className={"flattenPreviewMask " + shapeClass(zone.shape)} style={toStyle(zone)}><span>{index + 1}</span></div>
                ))}
              </div>
            ) : <div className="flattenPreviewEmpty">Generate a flattened preview first.</div>}
            <p className="helperText">{flattenedSurfaceMessage}</p>
          </div>
        </section>
      )}

`;
  const index = text.indexOf(marker);
  if (index === -1) throw new Error("Could not find content step marker");
  text = text.slice(0, index) + flatBlock + text.slice(index);
}

writeFileSync(path, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".flatViewShell")) {
  css += `
.flatViewShell{grid-template-columns:280px 1fr}.flatViewPanel{margin-top:0}.flatViewStage{max-width:100%;overflow:auto}.flatViewStage img{max-height:78vh}@media(max-width:960px){.flatViewShell{display:flex!important;flex-direction:column!important;gap:10px!important}.flatViewShell .toolPanel{order:1!important;margin:0 8px!important;padding:12px!important;border-radius:18px!important}.flatViewPanel{order:0!important;margin:0 8px!important;padding:10px!important}.flatViewStage img{max-height:none!important}}
`;
  writeFileSync(cssPath, css);
}
