import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const geometryImport = 'import { zoneToGeometryPoints } from "./shapeGeometry";\n';

if (!text.includes(geometryImport)) {
  text = text.replace(edgeImport, edgeImport + geometryImport);
}

const startMarker = "// --- GEOMETRY ENGINE START ---";
const endMarker = "// --- GEOMETRY ENGINE END ---";

if (text.includes(startMarker) && text.includes(endMarker)) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start) + endMarker.length;
  text = text.slice(0, start) + "\n" + text.slice(end);
}

const maskShapeType = 'type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";\n\n';

if (!text.includes('type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";')) {
  text = text.replace("type ProjectZone = Zone & {", maskShapeType + "type ProjectZone = Zone & {");
}

if (!text.includes("function normalizeZoneShape")) {
  text = text.replace(
    "const shapeClass = (shape?: MaskShape) => `shape-${shape ?? \"rectangle\"}`;",
    `const normalizeShape = (shape?: MaskShape, label?: string) => {
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

const shapeClass = (shape?: MaskShape) => \`shape-\${shape ?? "rectangle"}\`;`
  );
}

text = text.replace(
  "const includedZones = zones.filter((zone) => zone.included);",
  "const includedZones = zones.filter((zone) => zone.included).map(normalizeZoneShape);"
);

if (!text.includes("function renderZoneMaskPrimitive")) {
  text = text.replace(
    "  function renderPolygonProjectionLayer(extra = \"\") {",
    `  function renderZoneMaskPrimitive(zone: ProjectZone, key: string) {
    const shape = normalizeShape(zone.shape, zone.label);
    const x = zone.x;
    const y = zone.y;
    const w = zone.width;
    const h = zone.height;

    if (zone.points && zone.points.length >= 3) {
      return <polygon key={key} points={zone.points.map((point) => point.x + "," + point.y).join(" ")} fill="black" />;
    }

    if (shape === "circle") {
      const size = Math.min(w, h);
      return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={size / 2} ry={size / 2} fill="black" />;
    }

    if (shape === "oval") {
      return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="black" />;
    }

    if (shape === "triangle") {
      return <polygon key={key} points={(x + w / 2) + "," + y + " " + (x + w) + "," + (y + h) + " " + x + "," + (y + h)} fill="black" />;
    }

    return <rect key={key} x={x} y={y} width={w} height={h} fill="black" />;
  }

  function renderPolygonProjectionLayer(extra = "") {`
  );
}

text = text.replace(
  /\{includedZones\.map\(\(zone\) => \(\s*<rect key=\{`pm-\$\{zone\.id\}`} x=\{zone\.x\} y=\{zone\.y\} width=\{zone\.width\} height=\{zone\.height\} fill="black" \/>\s*\)\)\}/s,
  "{includedZones.map((zone) => renderZoneMaskPrimitive(zone, `pm-${zone.id}`))}"
);

text = text.replace(
  "          {invertMode && includedZones.map((zone) => (",
  "          {invertMode && !surfacePolygonClosed && includedZones.map((zone) => ("
);

writeFileSync(appPath, text);
