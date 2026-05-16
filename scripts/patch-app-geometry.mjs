import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const geometryImport = 'import { zoneToGeometryPoints } from "./shapeGeometry";\n';
if (!text.includes(geometryImport)) text = text.replace(edgeImport, edgeImport + geometryImport);

const startMarker = "// --- GEOMETRY ENGINE START ---";
const endMarker = "// --- GEOMETRY ENGINE END ---";
if (text.includes(startMarker) && text.includes(endMarker)) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start) + endMarker.length;
  text = text.slice(0, start) + "\n" + text.slice(end);
}

const maskShapeType = 'type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";\n\n';
if (!text.includes('type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";')) text = text.replace("type ProjectZone = Zone & {", maskShapeType + "type ProjectZone = Zone & {");

if (!text.includes("function normalizeZoneShape")) {
  text = text.replace("const shapeClass = (shape?: MaskShape) => `shape-${shape ?? \"rectangle\"}`;", `const normalizeShape = (shape?: MaskShape, label?: string) => {
  const normalizedLabel = (label ?? "").toLowerCase();
  if (shape === "circle" || normalizedLabel.includes("circle")) return "circle";
  if (shape === "oval" || normalizedLabel.includes("oval")) return "oval";
  if (shape === "triangle" || normalizedLabel.includes("triangle")) return "triangle";
  if (shape === "freehand" || normalizedLabel.includes("freehand")) return "freehand";
  return shape ?? "rectangle";
};

function normalizeZoneShape<T extends { shape?: MaskShape; label?: string }>(zone: T): T {
  return { ...zone, shape: normalizeShape(zone.shape, zone.label) };
}

const shapeClass = (shape?: MaskShape) => \`shape-\${shape ?? "rectangle"}\`;`);
}

text = text.replace("const includedZones = zones.filter((zone) => zone.included);", "const includedZones = zones.filter((zone) => zone.included).map(normalizeZoneShape);");

if (!text.includes("function getCircleStageAspect")) {
  text = text.replace("  function getPoint(event: React.PointerEvent, allowSnap = true) {", `  function getCircleStageAspect() {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return rect && rect.height > 0 ? rect.width / rect.height : 1;
  }

  function getCircleDraftZone(draft: DraftZone): Omit<ProjectZone, "id" | "included"> {
    const aspect = getCircleStageAspect();
    const dx = draft.currentX - draft.startX;
    const dy = draft.currentY - draft.startY;
    const width = Math.min(Math.abs(dx), Math.abs(dy) / Math.max(aspect, 0.001));
    const height = width * aspect;
    const x = dx < 0 ? draft.startX - width : draft.startX;
    const y = dy < 0 ? draft.startY - height : draft.startY;
    return clampZone({ x, y, width, height, shape: "circle" });
  }

  function lockCircleResizeZone(original: ProjectZone, point: { x: number; y: number }, mode: ResizeMode): Pick<Zone, "x" | "y" | "width" | "height"> {
    if (mode === "move") return clampZonePositionOnly({ x: point.x, y: point.y, width: original.width, height: original.height });
    const aspect = getCircleStageAspect();
    const centerX = original.x + original.width / 2;
    const centerY = original.y + original.height / 2;
    let width = original.width;
    if (mode.includes("e")) width = Math.max(2, (point.x - original.x) * 2);
    else if (mode.includes("w")) width = Math.max(2, (original.x + original.width - point.x) * 2);
    else if (mode.includes("s")) width = Math.max(2, ((point.y - original.y) * 2) / Math.max(aspect, 0.001));
    else if (mode.includes("n")) width = Math.max(2, ((original.y + original.height - point.y) * 2) / Math.max(aspect, 0.001));
    const height = width * aspect;
    return clampZone({ x: centerX - width / 2, y: centerY - height / 2, width, height });
  }

  function getPoint(event: React.PointerEvent, allowSnap = true) {`);
}

text = text.replace("  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;", "  const draftRect = draftZone ? (draftZone.shape === \"circle\" ? getCircleDraftZone(draftZone) : normalizeDraftZone(draftZone)) : null;");
text = text.replace("    const rect = normalizeDraftZone(draftZone);", "    const rect = draftZone.shape === \"circle\" ? getCircleDraftZone(draftZone) : normalizeDraftZone(draftZone);");

text = text.replace(
  "    const update = action.mode === \"move\" \n      ? clampZonePositionOnly({ x, y, width: original.width, height: original.height }) \n      : clampZone({ x, y, width, height });",
  "    const update = original.shape === \"circle\"\n      ? lockCircleResizeZone(original, point, action.mode)\n      : action.mode === \"move\" \n        ? clampZonePositionOnly({ x, y, width: original.width, height: original.height }) \n        : clampZone({ x, y, width, height });"
);

if (!text.includes("function renderZoneMaskPrimitive")) {
  text = text.replace("  function renderPolygonProjectionLayer(extra = \"\") {", `  function renderZoneMaskPrimitive(zone: ProjectZone, key: string) {
    const shape = normalizeShape(zone.shape, zone.label);
    const x = zone.x;
    const y = zone.y;
    const w = zone.width;
    const h = zone.height;
    if (zone.points && zone.points.length >= 3) return <polygon key={key} points={zone.points.map((point) => point.x + "," + point.y).join(" ")} fill="black" />;
    if (shape === "circle" || shape === "oval") return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="black" />;
    if (shape === "triangle") return <polygon key={key} points={(x + w / 2) + "," + y + " " + (x + w) + "," + (y + h) + " " + x + "," + (y + h)} fill="black" />;
    return <rect key={key} x={x} y={y} width={w} height={h} fill="black" />;
  }

  function renderPolygonProjectionLayer(extra = "") {`);
}

text = text.replace(/\{includedZones\.map\(\(zone\) => \(\s*<rect key=\{`pm-\$\{zone\.id\}`} x=\{zone\.x\} y=\{zone\.y\} width=\{zone\.width\} height=\{zone\.height\} fill="black" \/>\s*\)\)\}/s, "{includedZones.map((zone) => renderZoneMaskPrimitive(zone, `pm-${zone.id}`))}");
text = text.replace("          {invertMode && includedZones.map((zone) => (", "          {invertMode && !surfacePolygonClosed && includedZones.map((zone) => (");

writeFileSync(appPath, text);
