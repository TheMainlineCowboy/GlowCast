import fs from 'node:fs';

const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
let changed = false;

if (!s.includes('runCandidateDetection')) {
  s = s.replace(
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\nimport { runCandidateDetection } from "./core/runCandidateDetection";'
  );
  changed = true;
}

const functionBlock = `
  async function runLocalAutoMaskDetection() {
    if (!imageUrl) return;

    try {
      setDetecting(true);
      setDebugWarnings([]);
      setDrawMode(false);
      setCornerMode(false);
      setCornerPoints([]);
      setSurfacePolygonMode(false);
      setProjectionOnly(false);
      setDetectMessage("Running local architectural mask detection...");

      let activeEdgePoints = edgePoints;
      if (!activeEdgePoints.length) {
        const scan = await scanImageEdges(imageUrl);
        activeEdgePoints = scan.edgePoints;
        setEdgeOverlayUrl(scan.edgeCanvasUrl);
        setEdgePoints(scan.edgePoints);
        setShowEdges(true);
      }

      const bounds = surfacePolygonClosed && surfacePolygonPoints.length >= 3
        ? flattenedSurface()
        : projectionArea ?? flattenedSurface();
      const polygon = surfacePolygonClosed && surfacePolygonPoints.length >= 3 ? surfacePolygonPoints : null;
      const detected = runCandidateDetection(activeEdgePoints, bounds, polygon).map((candidate, index) => ({
        ...candidate,
        id: Date.now() + index,
        included: true,
        shape: candidate.shape ?? "rectangle",
        label: candidate.label ?? `Auto architectural mask ${index + 1}`
      }));

      setZones((current) => [
        ...current.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")),
        ...detected
      ]);

      if (detected.length) {
        setSelectedTarget("zone");
        setSelectedZoneId(detected[0].id);
        setDetectMessage(`Auto detection created ${detected.length} editable architectural mask${detected.length === 1 ? "" : "s"}.`);
      } else {
        setSelectedTarget("surface");
        setSelectedZoneId(null);
        setDetectMessage("Auto detection did not find usable architectural masks yet. Try showing the edge scanner or drawing the projection surface tighter.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local auto mask detection failed.";
      setDebugWarnings([message]);
      setDetectMessage("Local auto mask detection failed. Manual masks still work.");
    } finally {
      setDetecting(false);
    }
  }
`;

if (!s.includes('async function runLocalAutoMaskDetection()')) {
  const anchor = '\n  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {';
  if (!s.includes(anchor)) throw new Error('Could not find resetForPhoto anchor.');
  s = s.replace(anchor, `${functionBlock}${anchor}`);
  changed = true;
}

const buttonBlock = `
              <button type="button" className="primary" onClick={runLocalAutoMaskDetection} disabled={!imageUrl || detecting || edgeScanning || cornerMode || surfacePolygonMode}>
                <ScanLine size={18} /> {detecting ? "Detecting Masks..." : "Auto Detect Masks"}
              </button>`;

if (!s.includes('Auto Detect Masks')) {
  const anchor = `              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>`;
  if (!s.includes(anchor)) throw new Error('Could not find edge scanner button anchor.');
  s = s.replace(anchor, `${anchor}${buttonBlock}`);
  changed = true;
}

if (!changed) {
  console.log('No changes made. Auto detect masks UI patch may already be applied.');
} else {
  fs.writeFileSync(p, s);
  console.log('Applied auto detect masks UI patch.');
}
