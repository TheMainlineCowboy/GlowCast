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

const helperStart = text.indexOf("  function zoneToFlattenedPreviewZone(");
const helperEnd = helperStart === -1 ? -1 : text.indexOf("  function distanceBetweenPoints(", helperStart);
const helperBlock = `  function zoneToFlattenedPreviewZone(zone: ProjectZone, transform: ReturnType<typeof homography>, outW: number, outH: number): ProjectZone | null {
    const transformedPoints = zoneToGeometryPoints(zone, 72).map((point) => apply(transform, point));
    if (!transformedPoints.length) return null;
    const xs = transformedPoints.map((point) => point.x);
    const ys = transformedPoints.map((point) => point.y);
    const x1 = Math.max(0, Math.min(...xs));
    const y1 = Math.max(0, Math.min(...ys));
    const x2 = Math.min(outW, Math.max(...xs));
    const y2 = Math.min(outH, Math.max(...ys));
    if (x2 <= x1 || y2 <= y1) return null;
    return {
      ...zone,
      x: Number(((x1 / outW) * 100).toFixed(2)),
      y: Number(((y1 / outH) * 100).toFixed(2)),
      width: Number((((x2 - x1) / outW) * 100).toFixed(2)),
      height: Number((((y2 - y1) / outH) * 100).toFixed(2)),
      points: transformedPoints.map((point) => ({
        x: Number(((Math.max(0, Math.min(outW, point.x)) / outW) * 100).toFixed(2)),
        y: Number(((Math.max(0, Math.min(outH, point.y)) / outH) * 100).toFixed(2))
      }))
    };
  }

  function flattenedZonePointsString(zone: ProjectZone) {
    const points = zone.points?.length ? zone.points : zoneToGeometryPoints(zone, 72);
    return points.map((point) => point.x + "," + point.y).join(" ");
  }

  function flattenedZoneLabelPoint(zone: ProjectZone) {
    const points = zone.points?.length ? zone.points : zoneToGeometryPoints(zone, 72);
    if (!points.length) return { x: zone.x, y: zone.y };
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { x: Math.min(...xs) + 2, y: Math.min(...ys) + 5 };
  }

`;

if (helperStart !== -1 && helperEnd !== -1 && helperEnd > helperStart) {
  text = text.slice(0, helperStart) + helperBlock + text.slice(helperEnd);
} else {
  text = text.replace("  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {", helperBlock + "  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) {");
}

text = text.replace(
  '      setFlattenedSurfaceUrl(canvas.toDataURL("image/png"));\n      setFlattenedSurfaceMessage("Flattened preview generated with normalized corner order and selected surface aspect ratio.");',
  '      const surfaceToFlat = homography(quad, flatDestination(previewSize.width, previewSize.height));\n      setFlattenedSurfaceUrl(canvas.toDataURL("image/png"));\n      setFlattenedPreviewZones(zones.map((zone) => zoneToFlattenedPreviewZone(zone, surfaceToFlat, previewSize.width, previewSize.height)).filter(Boolean) as ProjectZone[]);\n      setFlattenedSurfaceMessage("Flattened preview generated with current avoid masks overlaid.");'
);

text = text.replaceAll(
  'setFlattenedSurfaceUrl(null);\n    setFlattenedSurfaceMessage("Flattened preview has not been generated yet.");',
  'setFlattenedSurfaceUrl(null);\n    setFlattenedPreviewZones([]);\n    setFlattenedSurfaceMessage("Flattened preview has not been generated yet.");'
);

const svgPreviewBlock = `{flattenedSurfaceUrl ? (
                  <div className="flattenPreviewStage">
                    <img src={flattenedSurfaceUrl} alt="Flattened projection surface preview" />
                    <svg className="flattenPreviewSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      {flattenedPreviewZones.map((zone, index) => {
                        const labelPoint = flattenedZoneLabelPoint(zone);
                        return (
                          <g key={zone.id + "-flat-path-" + index} className={"flattenPreviewMaskPath " + shapeClass(zone.shape)}>
                            <polygon points={flattenedZonePointsString(zone)} />
                            <circle cx={labelPoint.x} cy={labelPoint.y} r="3.2" className="flattenPreviewLabelBubble" />
                            <text x={labelPoint.x} y={labelPoint.y + 1.2} textAnchor="middle" className="flattenPreviewLabelText">{index + 1}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : <div className="flattenPreviewEmpty">No flattened preview yet.</div>}`;

text = text.replace(
  '{flattenedSurfaceUrl ? <img src={flattenedSurfaceUrl} alt="Flattened projection surface preview" /> : <div className="flattenPreviewEmpty">No flattened preview yet.</div>}',
  svgPreviewBlock
);

text = text.replace(
  /\{flattenedSurfaceUrl \? \(\n\s*<div className="flattenPreviewStage">\n\s*<img src=\{flattenedSurfaceUrl\} alt="Flattened projection surface preview" \/>\n\s*\{flattenedPreviewZones\.map\(\(zone, index\) => \(\n\s*<div key=\{zone\.id \+ "-flat-" \+ index\} className=\{`flattenPreviewMask \$\{shapeClass\(zone\.shape\)\}`\} style=\{toStyle\(zone\)\}>\n\s*<span>\{index \+ 1\}<\/span>\n\s*<\/div>\n\s*\)\)\}\n\s*<\/div>\n\s*\) : <div className="flattenPreviewEmpty">No flattened preview yet\.<\/div>\}/,
  svgPreviewBlock
);

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".flattenPreviewStage")) {
  css += `\n.flattenPreviewStage{position:relative;display:block;width:max-content;max-width:100%;margin:0 auto}.flattenPreviewStage img{max-width:100%;width:auto;margin:0 auto;display:block;border-radius:14px;background:#020617}.flattenPreviewMask{position:absolute;border:3px solid #fef08a;background:rgba(253,224,71,.10);pointer-events:none;z-index:3;box-shadow:0 0 16px rgba(250,204,21,.28)}.flattenPreviewMask span{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.82);color:#020617;font-weight:900;display:grid;place-items:center;font-size:12px}.flattenPreviewMask.shape-oval,.flattenPreviewMask.shape-circle{border-radius:999px}.flattenPreviewMask.shape-triangle{clip-path:polygon(50% 0,100% 100%,0 100%);border-radius:0}.flattenPreviewMask.shape-freehand{border-radius:42% 58% 48% 52%/55% 38% 62% 45%}@media(max-width:960px){.flattenPreviewMask{border-width:2px}.flattenPreviewMask span{width:20px;height:20px;font-size:10px}}\n`;
}
if (!css.includes("flatten-preview true path v1")) {
  css += `\n/* flatten-preview true path v1 */\n.flattenPreviewSvg{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible}.flattenPreviewMaskPath polygon{fill:rgba(253,224,71,.12);stroke:#fef08a;stroke-width:.7;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 5px rgba(250,204,21,.45))}.flattenPreviewLabelBubble{fill:rgba(255,255,255,.86);stroke:rgba(2,6,23,.35);stroke-width:.25}.flattenPreviewLabelText{fill:#020617;font-size:4px;font-weight:900;dominant-baseline:middle;pointer-events:none}.flattenPreviewMask{display:none!important}\n`;
}
writeFileSync(cssPath, css);
