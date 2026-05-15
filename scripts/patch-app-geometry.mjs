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

writeFileSync(appPath, text);
