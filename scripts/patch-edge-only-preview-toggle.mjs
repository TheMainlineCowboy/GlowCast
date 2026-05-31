import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

function replaceOnce(haystack, needle, replacement, label) {
  if (!haystack.includes(needle)) {
    console.log(`edge-only preview patch skipped ${label}; already patched or anchor missing`);
    return haystack;
  }
  return haystack.replace(needle, replacement);
}

app = replaceOnce(
  app,
  `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
  `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOnlyPreview, setEdgeOnlyPreview] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
  "state"
);

app = replaceOnce(
  app,
  `    setShowEdges(false);\n    setEdgeOverlayUrl(null);`,
  `    setShowEdges(false);\n    setEdgeOnlyPreview(false);\n    setEdgeOverlayUrl(null);`,
  "resetEdgeScanner"
);

app = replaceOnce(
  app,
  `    if (showEdges) {\n      setShowEdges(false);\n      return;\n    }`,
  `    if (showEdges) {\n      setShowEdges(false);\n      setEdgeOnlyPreview(false);\n      return;\n    }`,
  "hide scanner reset"
);

app = replaceOnce(
  app,
  `      setEdgePoints(result.edgePoints);\n      setShowEdges(true);`,
  `      setEdgePoints(result.edgePoints);\n      setShowEdges(true);\n      setEdgeOnlyPreview(false);`,
  "scan complete default"
);

app = replaceOnce(
  app,
  `    setProjectionOnly(false);\n    setDebugWarnings([]);`,
  `    setProjectionOnly(false);\n    setEdgeOnlyPreview(false);\n    setDebugWarnings([]);`,
  "resetForPhoto edge-only reset"
);

app = replaceOnce(
  app,
  `    setProjectionOnly(false);\n    setDebugWarnings([]);\n    setCornerMode(false);`,
  `    setProjectionOnly(false);\n    setEdgeOnlyPreview(false);\n    setDebugWarnings([]);\n    setCornerMode(false);`,
  "loadProject edge-only reset"
);

app = replaceOnce(
  app,
  `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""}\`}>`,
  `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""} \${edgeOnlyPreview ? "edgeOnlyPreview" : ""}\`}>`,
  "stage class"
);

app = replaceOnce(
  app,
  `          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n\n          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}`,
  `          {!edgeOnlyPreview ? surfacePolygonOverlay() : null}\n          {!edgeOnlyPreview ? cornerOverlay() : null}\n\n          {!edgeOnlyPreview && surfacePolygonClosed ? renderPolygonProjectionLayer() : null}`,
  "surface/corner overlays"
);

app = replaceOnce(
  app,
  `          {projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? (`,
  `          {projectionArea && showSurfaceHandles && !projectionOnly && !edgeOnlyPreview && !cornerMode && !surfacePolygonMode ? (`,
  "surface boundary hide"
);

app = replaceOnce(
  app,
  `          {invertMode && projectionArea && !surfacePolygonClosed && (`,
  `          {invertMode && projectionArea && !edgeOnlyPreview && !surfacePolygonClosed && (`,
  "projection surface hide"
);

app = replaceOnce(
  app,
  `          {invertMode && includedZones.map((zone) => (`,
  `          {!edgeOnlyPreview && invertMode && includedZones.map((zone) => (`,
  "cutouts hide"
);

app = replaceOnce(
  app,
  `          {!invertMode && includedZones.map((zone) => (`,
  `          {!edgeOnlyPreview && !invertMode && includedZones.map((zone) => (`,
  "zone projections hide"
);

app = replaceOnce(
  app,
  `          {!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (`,
  `          {!edgeOnlyPreview && !projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (`,
  "zone editor overlays hide"
);

app = replaceOnce(
  app,
  `          {draftRect && !projectionOnly && !cornerMode && !surfacePolygonMode && (`,
  `          {!edgeOnlyPreview && draftRect && !projectionOnly && !cornerMode && !surfacePolygonMode && (`,
  "draft hide"
);

app = replaceOnce(
  app,
  `              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>`,
  `              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>\n              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={edgeOnlyPreview} disabled={!showEdges || !edgeOverlayUrl} onChange={(event) => setEdgeOnlyPreview(event.target.checked)} /> Edge-only view\n              </label>`,
  "edge only toggle"
);

app = replaceOnce(
  app,
  `                 {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}`, 
  `                 {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}`,
  "noop"
);

writeFileSync(appPath, app);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
const cssPatch = `.stage.edgeOnlyPreview .surfaceLayer{background:#020617}.stage.edgeOnlyPreview .referencePhoto{opacity:0!important}.stage.edgeOnlyPreview .edgeOverlay{opacity:1!important;mix-blend-mode:normal!important;filter:drop-shadow(0 0 3px rgba(103,232,249,.75))}.stage.edgeOnlyPreview .projectionBoundary,.stage.edgeOnlyPreview .projectionSurface,.stage.edgeOnlyPreview .zone,.stage.edgeOnlyPreview .maskCutout,.stage.edgeOnlyPreview .zoneProjection,.stage.edgeOnlyPreview .draftZone,.stage.edgeOnlyPreview .surfacePolygonOverlay{display:none!important}`;
if (!css.includes(".stage.edgeOnlyPreview")) {
  css += cssPatch;
}
writeFileSync(cssPath, css);
console.log("added edge-only scanned edge preview toggle");
