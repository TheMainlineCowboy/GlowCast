import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

if (!text.includes("const [flattenedSurfaceUrl")) {
  text = text.replace(
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [flattenedSurfaceUrl, setFlattenedSurfaceUrl] = useState<string | null>(null);\n  const [flattenedSurfaceMessage, setFlattenedSurfaceMessage] = useState(\"Flattened preview has not been generated yet.\");"
  );
}

if (!text.includes("async function generateFlattenedSurfacePreview")) {
  text = text.replace(
    "  function resetSurfacePolygon() {",
    "  async function generateFlattenedSurfacePreview() {\n    if (!imageUrl || surfacePolygonPoints.length < 4) {\n      setFlattenedSurfaceMessage(\"Set a four-point projection surface first.\");\n      return;\n    }\n    try {\n      setFlattenedSurfaceMessage(\"Generating flattened surface preview...\");\n      const image = await loadImage(imageUrl);\n      const quad = surfacePolygonPoints.slice(0, 4).map((point) => ({ x: point.x, y: point.y })) as Quad;\n      const canvas = warpImageToCanvas(image, quad, 1200, 675);\n      setFlattenedSurfaceUrl(canvas.toDataURL(\"image/png\"));\n      setFlattenedSurfaceMessage(\"Flattened preview generated from the first four surface points.\");\n    } catch (error) {\n      setFlattenedSurfaceMessage(error instanceof Error ? error.message : \"Could not generate flattened surface preview.\");\n    }\n  }\n\n  function resetSurfacePolygon() {"
  );
}

text = text.replace(
  "    setSurfacePolygonClosed(false);",
  "    setSurfacePolygonClosed(false);\n    setFlattenedSurfaceUrl(null);\n    setFlattenedSurfaceMessage(\"Flattened preview has not been generated yet.\");"
);

text = text.replace(
  "    resetSurfacePolygon();\n    resetEdgeScanner();",
  "    resetSurfacePolygon();\n    setFlattenedSurfaceUrl(null);\n    setFlattenedSurfaceMessage(\"Flattened preview has not been generated yet.\");\n    resetEdgeScanner();"
);

text = text.replace(
  "              <button className=\"primary\" type=\"button\" onClick={() => setStep(\"mask\")} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>",
  "              <button type=\"button\" onClick={generateFlattenedSurfacePreview} disabled={!imageUrl || surfacePolygonPoints.length < 4}>Flatten Surface Preview</button>\n              <button className=\"primary\" type=\"button\" onClick={() => setStep(\"mask\")} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>"
);

text = text.replace(
  "          {imageUrl ? stage : null}\n        </section>",
  "          {imageUrl ? (\n            <div className=\"startStageColumn\">\n              {stage}\n              <div className=\"flattenPreviewPanel\">\n                <div className=\"recentHeader\"><strong>Flattened Surface Preview</strong><span>v1 preview only</span></div>\n                {flattenedSurfaceUrl ? <img src={flattenedSurfaceUrl} alt=\"Flattened projection surface preview\" /> : <div className=\"flattenPreviewEmpty\">No flattened preview yet.</div>}\n                <p className=\"helperText\">{flattenedSurfaceMessage}</p>\n              </div>\n            </div>\n          ) : null}\n        </section>"
);

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".flattenPreviewPanel")) {
  css += `\n.flattenPreviewPanel{margin-top:12px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.72);border-radius:22px;padding:14px}.flattenPreviewPanel img{width:100%;display:block;border-radius:14px;background:#020617}.flattenPreviewEmpty{height:160px;display:grid;place-items:center;border:1px dashed rgba(148,163,184,.35);border-radius:14px;color:#94a3b8;background:rgba(2,6,23,.45)}.startStageColumn{min-width:0}@media(max-width:960px){.flattenPreviewPanel{margin:10px 8px 0!important;padding:10px!important;border-radius:16px!important}.flattenPreviewEmpty{height:120px!important}}\n`;
}
writeFileSync(cssPath, css);
