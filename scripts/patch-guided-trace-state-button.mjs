import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

if (!app.includes("edgeTraceMode")) {
  app = app.replace(
    "  const [edgeOnlyMode, setEdgeOnlyMode] = useState(false);",
    "  const [edgeOnlyMode, setEdgeOnlyMode] = useState(false);\n  const [edgeTraceMode, setEdgeTraceMode] = useState(false);"
  );
}

const anchor = `              <button type="button" onClick={createEdgeMaskCandidates} disabled={!imageUrl || !projectionArea || edgeScanning}>
                Create Edge Mask Candidates
              </button>`;

if (!app.includes("Trace Edge Mask")) {
  app = app.replace(anchor, `${anchor}
              <button type="button" onClick={() => { setEdgeTraceMode(true); setDrawMode(false); setProjectionOnly(false); void ensureEdgeScan(); setShowEdges(true); setDetectMessage("Trace Edge Mask active. Tap near one visible window or door edge."); }} disabled={!imageUrl || !projectionArea || edgeScanning} className={edgeTraceMode ? "activeStep" : ""}>
                Trace Edge Mask
              </button>`);
}

writeFileSync(appPath, app);
console.log("guided trace state and button added");
