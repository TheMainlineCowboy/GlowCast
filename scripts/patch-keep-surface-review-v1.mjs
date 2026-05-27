import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

source = source.replace(
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(false);\n          setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");',
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(true);\n          setSelectedTarget("surface");\n          setSelectedZoneId(null);\n          setDrawMode(false);\n          setDetectMessage("Projection surface closed. Review and adjust it before scanning edges or drawing masks.");'
);

writeFileSync(path, source);
