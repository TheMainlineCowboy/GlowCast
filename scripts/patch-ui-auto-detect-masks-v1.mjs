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

if (!s.includes('const [detectionDebug, setDetectionDebug]')) {
  const anchor = '  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);';
  if (!s.includes(anchor)) throw new Error('Could not find edgePoints state anchor.');
  s = s.replace(
    anchor,
    anchor + '\n  const [detectionDebug, setDetectionDebug] = useState<{ edgePoints: number; candidateMasks: number; polygonScoped: boolean; source: string } | null>(null);'
  );
  changed = true;
}

if (!s.includes('setDetectionDebug(null);')) {
  const anchor = '    setEdgePoints([]);';
  if (!s.includes(anchor)) throw new Error('Could not find resetEdgeScanner edgePoints anchor.');
  s = s.replace(anchor, anchor + '\n    setDetectionDebug(null);');
  changed = true;
}

if (!s.includes('source: "edge-scan-only"')) {
  const anchor = '      setEdgePoints(result.edgePoints);';
  if (!s.includes(anchor)) throw new Error('Could not find edge scanner state anchor.');
  s = s.replace(
    anchor,
    anchor + '\n      setDetectionDebug({ edgePoints: result.edgePoints.length, candidateMasks: 0, polygonScoped: surfacePolygonClosed && surfacePolygonPoints.length >= 3, source: "edge-scan-only" });'
  );
  changed = true;
}

const functionBlock = [
  '',
  '  async function runLocalAutoMaskDetection() {',
  '    if (!imageUrl) return;',
  '',
  '    try {',
  '      setDetecting(true);',
  '      setDebugWarnings([]);',
  '      setDrawMode(false);',
  '      setCornerMode(false);',
  '      setCornerPoints([]);',
  '      setSurfacePolygonMode(false);',
  '      setProjectionOnly(false);',
  '      setDetectMessage("Running local architectural mask detection...");',
  '',
  '      let activeEdgePoints = edgePoints;',
  '      let detectionSource = activeEdgePoints.length ? "existing-edge-scan" : "fresh-edge-scan";',
  '      if (!activeEdgePoints.length) {',
  '        const scan = await scanImageEdges(imageUrl);',
  '        activeEdgePoints = scan.edgePoints;',
  '        setEdgeOverlayUrl(scan.edgeCanvasUrl);',
  '        setEdgePoints(scan.edgePoints);',
  '        setShowEdges(true);',
  '      }',
  '',
  '      const polygonScoped = surfacePolygonClosed && surfacePolygonPoints.length >= 3;',
  '      const bounds = polygonScoped',
  '        ? flattenedSurface()',
  '        : projectionArea ?? flattenedSurface();',
  '      const polygon = polygonScoped ? surfacePolygonPoints : null;',
  '      const detected = runCandidateDetection(activeEdgePoints, bounds, polygon).map((candidate, index) => ({',
  '        ...candidate,',
  '        id: Date.now() + index,',
  '        included: true,',
  '        shape: candidate.shape ?? "rectangle",',
  '        label: candidate.label ?? "Auto architectural mask " + (index + 1)',
  '      }));',
  '',
  '      setDetectionDebug({',
  '        edgePoints: activeEdgePoints.length,',
  '        candidateMasks: detected.length,',
  '        polygonScoped,',
  '        source: detectionSource',
  '      });',
  '',
  '      setZones((current) => [',
  '        ...current.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")),',
  '        ...detected',
  '      ]);',
  '',
  '      if (detected.length) {',
  '        setSelectedTarget("zone");',
  '        setSelectedZoneId(detected[0].id);',
  '        setDetectMessage("Auto detection created " + detected.length + " editable architectural mask" + (detected.length === 1 ? "" : "s") + ".");',
  '      } else {',
  '        setSelectedTarget("surface");',
  '        setSelectedZoneId(null);',
  '        setDetectMessage("Auto detection did not find usable architectural masks yet. Try showing the edge scanner or drawing the projection surface tighter.");',
  '      }',
  '    } catch (error) {',
  '      const message = error instanceof Error ? error.message : "Local auto mask detection failed.";',
  '      setDebugWarnings([message]);',
  '      setDetectMessage("Local auto mask detection failed. Manual masks still work.");',
  '    } finally {',
  '      setDetecting(false);',
  '    }',
  '  }',
  ''
].join('\n');

if (!s.includes('async function runLocalAutoMaskDetection()')) {
  const anchor = '\n  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {';
  if (!s.includes(anchor)) throw new Error('Could not find resetForPhoto anchor.');
  s = s.replace(anchor, functionBlock + anchor);
  changed = true;
} else {
  const start = s.indexOf('  async function runLocalAutoMaskDetection()');
  const end = s.indexOf('\n  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {', start);
  if (start >= 0 && end > start && !s.slice(start, end).includes('setDetectionDebug({')) {
    s = s.slice(0, start) + functionBlock.trimStart() + s.slice(end);
    changed = true;
  }
}

const buttonBlock = '\n              <button type="button" className="primary" onClick={runLocalAutoMaskDetection} disabled={!imageUrl || detecting || edgeScanning || cornerMode || surfacePolygonMode}>\n                <ScanLine size={18} /> {detecting ? "Detecting Masks..." : "Auto Detect Masks"}\n              </button>';

if (!s.includes('Auto Detect Masks')) {
  const anchor = '              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >\n                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}\n              </button>';
  if (!s.includes(anchor)) throw new Error('Could not find edge scanner button anchor.');
  s = s.replace(anchor, anchor + buttonBlock);
  changed = true;
}

const debugBlock = '\n              {detectionDebug && (\n                <p className="helperText">\n                  Debug: {detectionDebug.edgePoints.toLocaleString()} edges · {detectionDebug.candidateMasks} masks · {detectionDebug.polygonScoped ? "surface polygon scoped" : "full surface bounds"} · {detectionDebug.source}\n                </p>\n              )}';

if (!s.includes('Debug: {detectionDebug.edgePoints.toLocaleString()} edges')) {
  const helperStart = s.indexOf('              <p className="helperText">\n                {surfacePolygonMode ?');
  if (helperStart < 0) throw new Error('Could not find mask helperText anchor start.');
  const helperEnd = s.indexOf('\n              </p>', helperStart);
  if (helperEnd < 0) throw new Error('Could not find mask helperText anchor end.');
  const insertAfter = helperEnd + '\n              </p>'.length;
  s = s.slice(0, insertAfter) + debugBlock + s.slice(insertAfter);
  changed = true;
}

if (!changed) {
  console.log('No changes made. Auto detect masks UI patch may already be applied.');
} else {
  fs.writeFileSync(p, s);
  console.log('Applied auto detect masks UI patch.');
}
