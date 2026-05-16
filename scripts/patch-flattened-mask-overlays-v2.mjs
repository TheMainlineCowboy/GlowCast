import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

text = text.replace(
  'import { warpImageToCanvas, type Point, type Quad } from "./homography";',
  'import { apply, flatDestination, homography, warpImageToCanvas, type Point, type Quad } from "./homography";'
);

if (!text.includes("const [flattenedPreviewZones")) {
  text = text.replace(
    '  const [flattenedSurfaceMessage, setFlattenedSurfaceMessage] = useState("Flattened preview has not been generated yet.");',
    '  const [flattenedSurfaceMessage, setFlattenedSurfaceMessage] = useState("Flattened preview has not been generated yet.");\n  const [flattenedPreviewZones, setFlattenedPreviewZones] = useState<ProjectZone[]>([]);'
  );
}

if (!text.includes("function zoneToFlattenedPreviewZone")) {
  text = text.replace(
    "  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {",
    "  function zoneToFlattenedPreviewZone(zone: ProjectZone, transform: ReturnType<typeof homography>, outW: number, outH: number): ProjectZone | null {\n    const points = zoneToGeometryPoints(zone, 36).map((point) => apply(transform, point));\n    if (!points.length) return null;\n    const xs = points.map((point) => point.x);\n    const ys = points.map((point) => point.y);\n    const x1 = Math.max(0, Math.min(...xs));\n    const y1 = Math.max(0, Math.min(...ys));\n    const x2 = Math.min(outW, Math.max(...xs));\n    const y2 = Math.min(outH, Math.max(...ys));\n    if (x2 <= x1 || y2 <= y1) return null;\n    return {\n      ...zone,\n      x: Number(((x1 / outW) * 100).toFixed(2)),\n      y: Number(((y1 / outH) * 100).toFixed(2)),\n      width: Number((((x2 - x1) / outW) * 100).toFixed(2)),\n      height: Number((((y2 - y1) / outH) * 100).toFixed(2))\n    };\n  }\n\n  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {"
  );
}

text = text.replace(
  '      setFlattenedSurfaceUrl(canvas.toDataURL("image/png"));\n      setFlattenedSurfaceMessage("Flattened preview generated with normalized corner order and selected surface aspect ratio.");',
  '      const surfaceToFlat = homography(quad, flatDestination(previewSize.width, previewSize.height));\n      setFlattenedSurfaceUrl(canvas.toDataURL("image/png"));\n      setFlattenedPreviewZones(zones.map((zone) => zoneToFlattenedPreviewZone(zone, surfaceToFlat, previewSize.width, previewSize.height)).filter(Boolean) as ProjectZone[]);\n      setFlattenedSurfaceMessage("Flattened preview generated with current avoid masks overlaid.");'
);

text = text.replaceAll(
  'setFlattenedSurfaceUrl(null);\n    setFlattenedSurfaceMessage("Flattened preview has not been generated yet.");',
  'setFlattenedSurfaceUrl(null);\n    setFlattenedPreviewZones([]);\n    setFlattenedSurfaceMessage("Flattened preview has not been generated yet.");'
);

text = text.replace(
  '{flattenedSurfaceUrl ? <img src={flattenedSurfaceUrl} alt="Flattened projection surface preview" /> : <div className="flattenPreviewEmpty">No flattened preview yet.</div>}',
  '{flattenedSurfaceUrl ? (\n                  <div className="flattenPreviewStage">\n                    <img src={flattenedSurfaceUrl} alt="Flattened projection surface preview" />\n                    {flattenedPreviewZones.map((zone, index) => (\n                      <div key={zone.id + "-flat-" + index} className={`flattenPreviewMask ${shapeClass(zone.shape)}`} style={toStyle(zone)}>\n                        <span>{index + 1}</span>\n                      </div>\n                    ))}\n                  </div>\n                ) : <div className="flattenPreviewEmpty">No flattened preview yet.</div>}'
);

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".flattenPreviewStage")) {
  css += `\n.flattenPreviewStage{position:relative;display:block;width:max-content;max-width:100%;margin:0 auto}.flattenPreviewStage img{max-width:100%;width:auto;margin:0 auto;display:block;border-radius:14px;background:#020617}.flattenPreviewMask{position:absolute;border:3px solid #fef08a;background:rgba(253,224,71,.10);pointer-events:none;z-index:3;box-shadow:0 0 16px rgba(250,204,21,.28)}.flattenPreviewMask span{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.82);color:#020617;font-weight:900;display:grid;place-items:center;font-size:12px}.flattenPreviewMask.shape-oval,.flattenPreviewMask.shape-circle{border-radius:999px}.flattenPreviewMask.shape-triangle{clip-path:polygon(50% 0,100% 100%,0 100%);border-radius:0}.flattenPreviewMask.shape-freehand{border-radius:42% 58% 48% 52%/55% 38% 62% 45%}@media(max-width:960px){.flattenPreviewMask{border-width:2px}.flattenPreviewMask span{width:20px;height:20px;font-size:10px}}\n`;
}
writeFileSync(cssPath, css);
