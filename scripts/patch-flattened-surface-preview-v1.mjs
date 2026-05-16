import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

if (!text.includes("const [flattenedSurfaceUrl")) {
  text = text.replace(
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [flattenedSurfaceUrl, setFlattenedSurfaceUrl] = useState<string | null>(null);\n  const [flattenedSurfaceMessage, setFlattenedSurfaceMessage] = useState(\"Flattened preview has not been generated yet.\");"
  );
}

if (!text.includes("function normalizeSurfaceQuadOrder")) {
  text = text.replace(
    "  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {",
    "  function surfacePointDistancePixels(a: SurfacePoint, b: SurfacePoint, image: HTMLImageElement) {\n    const dx = ((a.x - b.x) / 100) * image.naturalWidth;\n    const dy = ((a.y - b.y) / 100) * image.naturalHeight;\n    return Math.sqrt(dx * dx + dy * dy);\n  }\n\n  function normalizeSurfaceQuadOrder(points: SurfacePoint[]) {\n    const quad = points.slice(0, 4);\n    const sortedByY = [...quad].sort((a, b) => a.y - b.y);\n    const topPair = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);\n    const bottomPair = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);\n    return [topPair[0], topPair[1], bottomPair[1], bottomPair[0]] as SurfacePoint[];\n  }\n\n  function getFlattenedPreviewSize(points: SurfacePoint[], image: HTMLImageElement) {\n    const [tl, tr, br, bl] = points;\n    const top = surfacePointDistancePixels(tl, tr, image);\n    const bottom = surfacePointDistancePixels(bl, br, image);\n    const left = surfacePointDistancePixels(tl, bl, image);\n    const right = surfacePointDistancePixels(tr, br, image);\n    const widthEdge = Math.max(1, (top + bottom) / 2);\n    const heightEdge = Math.max(1, (left + right) / 2);\n    const ratio = Math.min(4, Math.max(0.25, widthEdge / heightEdge));\n    const maxLongSide = 1200;\n    if (ratio >= 1) return { width: maxLongSide, height: Math.max(240, Math.round(maxLongSide / ratio)), ratio };\n    return { width: Math.max(240, Math.round(maxLongSide * ratio)), height: maxLongSide, ratio };\n  }\n\n  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {"
  );
}

text = text.replaceAll(
  "      const quadPoints = surfacePolygonPoints.slice(0, 4);\n      const quad = quadPoints.map((point) => ({ x: point.x, y: point.y })) as Quad;\n      const previewSize = getFlattenedPreviewSize(quadPoints, image);",
  "      const quadPoints = normalizeSurfaceQuadOrder(surfacePolygonPoints);\n      const quad = quadPoints.map((point) => ({ x: point.x, y: point.y })) as Quad;\n      const previewSize = getFlattenedPreviewSize(quadPoints, image);"
);

if (!text.includes("async function generateFlattenedSurfacePreview")) {
  text = text.replace(
    "  function resetSurfacePolygon() {",
    "  async function generateFlattenedSurfacePreview() {\n    if (!imageUrl || surfacePolygonPoints.length < 4) {\n      setFlattenedSurfaceMessage(\"Set a four-point projection surface first.\");\n      return;\n    }\n    try {\n      setFlattenedSurfaceMessage(\"Generating flattened surface preview...\");\n      const image = await loadImage(imageUrl);\n      const quadPoints = normalizeSurfaceQuadOrder(surfacePolygonPoints);\n      const quad = quadPoints.map((point) => ({ x: point.x, y: point.y })) as Quad;\n      const previewSize = getFlattenedPreviewSize(quadPoints, image);\n      const canvas = warpImageToCanvas(image, quad, previewSize.width, previewSize.height);\n      setFlattenedSurfaceUrl(canvas.toDataURL(\"image/png\"));\n      setFlattenedSurfaceMessage(\"Flattened preview generated with normalized corner order and selected surface aspect ratio.\");\n    } catch (error) {\n      setFlattenedSurfaceMessage(error instanceof Error ? error.message : \"Could not generate flattened surface preview.\");\n    }\n  }\n\n  function resetSurfacePolygon() {"
  );
} else {
  text = text.replaceAll(
    "setFlattenedSurfaceMessage(\"Flattened preview generated with the selected surface aspect ratio.\");",
    "setFlattenedSurfaceMessage(\"Flattened preview generated with normalized corner order and selected surface aspect ratio.\");"
  );
}

const flattenButton = "              <button type=\"button\" onClick={generateFlattenedSurfacePreview} disabled={!imageUrl || surfacePolygonPoints.length < 4}>Flatten Surface Preview</button>\n";
if (!text.includes("Flatten Surface Preview")) {
  const continueButtonRegex = /(              <button className=\"primary\" type=\"button\" onClick=\{\(\) => \{[^}]*setStep\(\"mask\"\); \}\} disabled=\{!surfacePolygonClosed && !projectionArea\}>Continue to Mask & Edit<\/button>)/;
  if (continueButtonRegex.test(text)) {
    text = text.replace(continueButtonRegex, flattenButton + "$1");
  } else {
    text = text.replace(
      "              <button className=\"primary\" type=\"button\" onClick={() => { setShowSurfaceHandles(false); setSurfacePointAction(null); setResizeAction(null); setSelectedTarget(\"zone\"); setSelectedZoneId(null); setStep(\"mask\"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>",
      flattenButton + "              <button className=\"primary\" type=\"button\" onClick={() => { setShowSurfaceHandles(false); setSurfacePointAction(null); setResizeAction(null); setSelectedTarget(\"zone\"); setSelectedZoneId(null); setStep(\"mask\"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>"
    );
  }
}

text = text.replace(
  "          {imageUrl ? stage : null}\n        </section>",
  "          {imageUrl ? (\n            <div className=\"startStageColumn\">\n              {stage}\n              <div className=\"flattenPreviewPanel\">\n                <div className=\"recentHeader\"><strong>Flattened Surface Preview</strong><span>v1 preview only</span></div>\n                {flattenedSurfaceUrl ? <img src={flattenedSurfaceUrl} alt=\"Flattened projection surface preview\" /> : <div className=\"flattenPreviewEmpty\">No flattened preview yet.</div>}\n                <p className=\"helperText\">{flattenedSurfaceMessage}</p>\n              </div>\n            </div>\n          ) : null}\n        </section>"
);

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".flattenPreviewPanel")) {
  css += `\n.flattenPreviewPanel{margin-top:12px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.72);border-radius:22px;padding:14px}.flattenPreviewPanel img{max-width:100%;width:auto;margin:0 auto;display:block;border-radius:14px;background:#020617}.flattenPreviewEmpty{height:160px;display:grid;place-items:center;border:1px dashed rgba(148,163,184,.35);border-radius:14px;color:#94a3b8;background:rgba(2,6,23,.45)}.startStageColumn{min-width:0}@media(max-width:960px){.flattenPreviewPanel{margin:10px 8px 0!important;padding:10px!important;border-radius:16px!important}.flattenPreviewPanel img{max-width:100%!important;width:auto!important}.flattenPreviewEmpty{height:120px!important}}\n`;
} else {
  css = css.replaceAll(".flattenPreviewPanel img{width:100%;display:block;border-radius:14px;background:#020617}", ".flattenPreviewPanel img{max-width:100%;width:auto;margin:0 auto;display:block;border-radius:14px;background:#020617}");
  css = css.replaceAll(".flattenPreviewPanel img{width:100%!important;", ".flattenPreviewPanel img{max-width:100%!important;width:auto!important;");
}
writeFileSync(cssPath, css);
