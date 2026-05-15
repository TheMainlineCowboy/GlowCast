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

// Some older UI states saved circle masks as rectangle-shaped zones with a circle label.
// Normalize that before geometry/mask rendering so circle uses real circle math.
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

writeFileSync(appPath, text);
