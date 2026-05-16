import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

if (!text.includes("const [showMaskOutlines")) {
  text = text.replace(
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showMaskOutlines, setShowMaskOutlines] = useState(true);"
  );
}

if (!text.includes('selectedZoneId(null);')) {
  text = text.replace(
    "    if (resizeAction) return;",
    "    if (resizeAction) return;\n\n    if (!drawMode && !cornerMode && !surfacePolygonMode && !(event.target as HTMLElement).closest(\".zone,.projectionBoundary,.resizeHandle\")) {\n      setSelectedTarget(\"surface\");\n      setSelectedZoneId(null);\n    }"
  );
}

text = text.replaceAll(
  "{zone.shape === \"triangle\" ? (",
  "{showMaskOutlines && zone.shape === \"triangle\" ? ("
);
text = text.replaceAll(
  "{(zone.shape === \"circle\" || zone.shape === \"oval\") ? (",
  "{showMaskOutlines && (zone.shape === \"circle\" || zone.shape === \"oval\") ? ("
);
text = text.replaceAll(
  "{zone.shape === \"freehand\" ? (",
  "{showMaskOutlines && zone.shape === \"freehand\" ? ("
);
text = text.replaceAll(
  "{renderHandles(\"zone\", zone)}",
  "{showMaskOutlines ? renderHandles(\"zone\", zone) : null}"
);

if (!text.includes("Hide Mask Outlines")) {
  text = text.replace(
    "              <button type=\"button\" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl} >\n                {showSurfaceHandles ? \"Hide Surface Handles\" : \"Show Surface Handles\"}\n              </button>",
    "              <button type=\"button\" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl} >\n                {showSurfaceHandles ? \"Hide Surface Handles\" : \"Show Surface Handles\"}\n              </button>\n              <button type=\"button\" onClick={() => setShowMaskOutlines((current) => !current)} disabled={!imageUrl} >\n                {showMaskOutlines ? \"Hide Mask Outlines\" : \"Show Mask Outlines\"}\n              </button>"
  );
}

writeFileSync(path, text);
