import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const legacyImport = 'import { zoneToGeometryPoints } from "./shapeGeometry";\n';
const coreImport = 'import { zoneToGeometryPoints, type MaskShape } from "./core/geometry";\n';

text = text.split(legacyImport).join("");

if (!text.includes(coreImport)) {
  if (!text.includes(edgeImport)) {
    throw new Error("Could not find edgeDetect import anchor.");
  }
  text = text.replace(edgeImport, edgeImport + coreImport);
}

const startMarker = "// --- GEOMETRY ENGINE START ---";
const endMarker = "// --- GEOMETRY ENGINE END ---";
const startIndex = text.indexOf(startMarker);
const endIndex = startIndex >= 0 ? text.indexOf(endMarker, startIndex) : -1;

if (startIndex >= 0 && endIndex >= 0) {
  text = text.slice(0, startIndex) + "\n" + text.slice(endIndex + endMarker.length);
}

writeFileSync(appPath, text);
