import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const snowImport = 'import { SnowEngine, type SnowSettings } from "./engines/Environmental/SnowEngine";\n';
if (!source.includes("./engines/Environmental/SnowEngine")) {
  source = source.replace(
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n',
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n' + snowImport
  );
}

const start = source.indexOf("// --- SNOW ENGINE START ---");
const end = source.indexOf("// --- SNOW ENGINE END ---", start);
if (start >= 0 && end > start) {
  const wrapper = `// --- SNOW ENGINE START ---
function CanvasSnowLayer({ ledges, settings }: { ledges: ProjectZone[]; settings?: SnowSettings }) {
  return <SnowEngine ledges={ledges} settings={settings} />;
}
// --- SNOW ENGINE END ---`;
  source = source.slice(0, start) + wrapper + source.slice(end + "// --- SNOW ENGINE END ---".length);
}

writeFileSync(appPath, source);
