import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

function replaceOnce(needle, replacement, label) {
  if (app.includes(replacement)) return;
  if (!app.includes(needle)) throw new Error(`Edge-only preview patch could not find ${label}`);
  app = app.replace(needle, replacement);
}

// State: force a real app-level edge-only preview state. Do not skip the whole patch just because
// another partial patch left the word edgeOnlyPreview somewhere else.
replaceOnce(
  `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
  `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOnlyPreview, setEdgeOnlyPreview] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
  "edge-only state"
);

app = app.replace(
  `    setShowEdges(false);\n    setEdgeOverlayUrl(null);`,
  `    setShowEdges(false);\n    setEdgeOnlyPreview(false);\n    setEdgeOverlayUrl(null);`
);

app = app.replace(
  `    if (showEdges) {\n      setShowEdges(false);\n      return;\n    }`,
  `    if (showEdges) {\n      setShowEdges(false);\n      setEdgeOnlyPreview(false);\n      return;\n    }`
);

app = app.replace(
  `      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgePoints(result.edgePoints);\n      setShowEdges(true);`,
  `      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgePoints(result.edgePoints);\n      setShowEdges(true);\n      setEdgeOnlyPreview(false);`
);

app = app.replaceAll(`setProjectionOnly(false);`, `setProjectionOnly(false);\n    setEdgeOnlyPreview(false);`);
app = app.replaceAll(`setProjectionOnly((value) => !value);`, `setEdgeOnlyPreview(false);\n                    setProjectionOnly((value) => !value);`);

// Stage class controls CSS that hides the house and all overlays except the edge image.
replaceOnce(
  `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""}\`}>`,
  `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""} \${edgeOnlyPreview ? "edgeOnlyPreview" : ""}\`}>`,
  "stage class"
);

app = app.replace(
  `          {showEdges && edgeOverlayUrl && !projectionOnly ? (\n            <img src={edgeOverlayUrl} className="edgeOverlay" alt="" draggable={false} />\n          ) : null}`,
  `          {showEdges && edgeOverlayUrl && !projectionOnly ? (\n            <img src={edgeOverlayUrl} className="edgeOverlay" alt="" draggable={false} />\n          ) : null}`
);

app = app.replace(
  `          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n\n          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}`,
  `          {!edgeOnlyPreview ? surfacePolygonOverlay() : null}\n          {!edgeOnlyPreview ? cornerOverlay() : null}\n\n          {!edgeOnlyPreview && surfacePolygonClosed ? renderPolygonProjectionLayer() : null}`
);

app = app.replace(
  `          {projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? (`,
  `          {projectionArea && showSurfaceHandles && !projectionOnly && !edgeOnlyPreview && !cornerMode && !surfacePolygonMode ? (`
);
app = app.replace(
  `          {invertMode && projectionArea && !surfacePolygonClosed && (`,
  `          {!edgeOnlyPreview && invertMode && projectionArea && !surfacePolygonClosed && (`
);
app = app.replace(
  `          {invertMode && includedZones.map((zone) => (`,
  `          {!edgeOnlyPreview && invertMode && includedZones.map((zone) => (`
);
app = app.replace(
  `          {!invertMode && includedZones.map((zone) => (`,
  `          {!edgeOnlyPreview && !invertMode && includedZones.map((zone) => (`
);
app = app.replace(
  `          {!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (`,
  `          {!edgeOnlyPreview && !projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (`
);
app = app.replace(
  `          {draftRect && !projectionOnly && !cornerMode && !surfacePolygonMode && (`,
  `          {!edgeOnlyPreview && draftRect && !projectionOnly && !cornerMode && !surfacePolygonMode && (`
);

// Put the control where it cannot be missed: directly below Show/Hide Edge Scanner.
const edgeButtonNeedle = `              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >\n                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}\n              </button>`;
const edgeButtonReplacement = `${edgeButtonNeedle}\n              <button type="button" onClick={() => setEdgeOnlyPreview((value) => !value)} disabled={!showEdges || !edgeOverlayUrl} className={edgeOnlyPreview ? "activeEffect" : ""} >\n                {edgeOnlyPreview ? "Show Photo + Edges" : "Edge-only View"}\n              </button>`;
replaceOnce(edgeButtonNeedle, edgeButtonReplacement, "visible edge-only button");

writeFileSync(appPath, app);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
const cssPatch = `
.stage.edgeOnlyPreview .surfaceLayer{background:#020617!important}
.stage.edgeOnlyPreview .referencePhoto{opacity:0!important}
.stage.edgeOnlyPreview .edgeOverlay{opacity:1!important;mix-blend-mode:normal!important;filter:drop-shadow(0 0 3px rgba(103,232,249,.95));z-index:50!important}
.stage.edgeOnlyPreview .projectionBoundary,.stage.edgeOnlyPreview .projectionSurface,.stage.edgeOnlyPreview .zone,.stage.edgeOnlyPreview .maskCutout,.stage.edgeOnlyPreview .zoneProjection,.stage.edgeOnlyPreview .draftZone,.stage.edgeOnlyPreview .surfacePolygonOverlay,.stage.edgeOnlyPreview .polygonProjectionLayer{display:none!important}
`;
if (!css.includes(".stage.edgeOnlyPreview")) css += cssPatch;
writeFileSync(cssPath, css);
console.log("added visible Edge-only View button and true edge-only stage mode");
