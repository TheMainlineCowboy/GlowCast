import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

function mustReplace(needle, replacement, label) {
  if (!app.includes(needle)) {
    if (app.includes(replacement.trim().slice(0, 40))) {
      console.log(`edge-only preview patch kept ${label}; already present`);
      return;
    }
    throw new Error(`Edge-only preview patch could not find ${label}`);
  }
  app = app.replace(needle, replacement);
}

if (!app.includes("edgeOnlyPreview")) {
  mustReplace(
    `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
    `  const [showEdges, setShowEdges] = useState(false);\n  const [edgeOnlyPreview, setEdgeOnlyPreview] = useState(false);\n  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);`,
    "edge-only state"
  );

  mustReplace(
    `    setShowEdges(false);\n    setEdgeOverlayUrl(null);`,
    `    setShowEdges(false);\n    setEdgeOnlyPreview(false);\n    setEdgeOverlayUrl(null);`,
    "edge scanner reset"
  );

  mustReplace(
    `    if (showEdges) {\n      setShowEdges(false);\n      return;\n    }`,
    `    if (showEdges) {\n      setShowEdges(false);\n      setEdgeOnlyPreview(false);\n      return;\n    }`,
    "edge scanner hide"
  );

  mustReplace(
    `      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgePoints(result.edgePoints);\n      setShowEdges(true);`,
    `      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgePoints(result.edgePoints);\n      setShowEdges(true);\n      setEdgeOnlyPreview(false);`,
    "edge scanner complete"
  );

  mustReplace(
    `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""}\`}>`,
    `  const stage = (\n    <div className={\`stage \${projectionOnly ? "projectionOnly" : ""} \${edgeOnlyPreview ? "edgeOnlyPreview" : ""}\`}>`,
    "stage class"
  );

  app = app.replaceAll(`setProjectionOnly(false);`, `setProjectionOnly(false);\n    setEdgeOnlyPreview(false);`);
  app = app.replaceAll(`setProjectionOnly((value) => !value);`, `setEdgeOnlyPreview(false); setProjectionOnly((value) => !value);`);

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

  mustReplace(
    `              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>`,
    `              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>\n              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={edgeOnlyPreview} disabled={!showEdges || !edgeOverlayUrl} onChange={(event) => setEdgeOnlyPreview(event.target.checked)} /> Edge-only view\n              </label>`,
    "edge-only toggle control"
  );
}

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
console.log("added edge-only scanned edge preview toggle");
