import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const snowImport = 'import { CanvasSnowLayer } from "./engines/Environmental/SnowEngine";\n';

if (!text.includes(snowImport)) {
  if (!text.includes(edgeImport)) throw new Error("Could not locate edgeDetect import anchor.");
  text = text.replace(edgeImport, edgeImport + snowImport);
}

const startMarker = "// --- SNOW ENGINE START ---";
const endMarker = "// --- SNOW ENGINE END ---";
const start = text.indexOf(startMarker);
const endMarkerIndex = start >= 0 ? text.indexOf(endMarker, start) : -1;

if (start >= 0 && endMarkerIndex >= 0) {
  const end = endMarkerIndex + endMarker.length;
  text = text.slice(0, start) + "\n" + text.slice(end);
}

writeFileSync(appPath, text);
