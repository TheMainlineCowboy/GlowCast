import fs from 'node:fs';

const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
let changed = false;

function insertAfterEdgeScannerButton(source, insertion) {
  const scannerText = 'Show Edge Scanner';
  const textIndex = source.indexOf(scannerText);
  if (textIndex < 0) return null;

  const buttonStart = source.lastIndexOf('<button', textIndex);
  if (buttonStart < 0) return null;

  const buttonEnd = source.indexOf('\n              </button>', textIndex);
  if (buttonEnd < 0) return null;

  const insertAt = buttonEnd + '\n              </button>'.length;
  return source.slice(0, insertAt) + insertion + source.slice(insertAt);
}

function insertDebugHelper(source, insertion) {
  const preferredStart = source.indexOf('              <p className="helperText">\n                {surfacePolygonMode ?');
  if (preferredStart >= 0) {
    const preferredEnd = source.indexOf('\n              </p>', preferredStart);
    if (preferredEnd >= 0) {
      const insertAt = preferredEnd + '\n              </p>'.length;
      return source.slice(0, insertAt) + insertion + source.slice(insertAt);
    }
  }

  const buttonText = 'Auto Detect Masks';
  const buttonIndex = source.indexOf(buttonText);
  if (buttonIndex >= 0) {
    const buttonEnd = source.indexOf('\n              </button>', buttonIndex);
    if (buttonEnd >= 0) {
      const insertAt = buttonEnd + '\n              </button>'.length;
      return source.slice(0, insertAt) + insertion + source.slice(insertAt);
    }
  }

  return null;
}

const runnerImport = 'import { runCandidateDetection } from "./core/runCandidateDetection";';
if (!s.includes(runnerImport)) {
  const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
  if (!s.includes(edgeImport)) throw new Error('Could not find edge detector import anchor.');
  s = s.replace(
    edgeImport,
    edgeImport + '\n' + runnerImport + '\nimport type { DetectorDiagnostics } from "./core/architecturalDetector";'
  );
  changed = true;
}

if (!s.includes('const [detectionDebug, setDetectionDebug]')) {
  const anchor = '  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);';
  if (!s.includes(anchor)) throw new Error('Could not find edgePoints state anchor.');
  s = s.replace(
    anchor,
    anchor + '\n  const [detectionDebug, setDetectionDebug] = useState<{ edgePoints: number; candidateMasks: number; polygonScoped: boolean; source: string; detectorDiagnostics: DetectorDiagnostics | null } | null>(null);'
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
    anchor + '\n      setDetectionDebug({ edgePoints: result.edgePoints.length, candidateMasks: 0, polygonScoped: surfacePolygonClosed && surfacePolygonPoints.length >= 3, source: "edge-scan-only", detectorDiagnostics: null });'
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
  '      let detectorDiagnostics: DetectorDiagnostics | null = null;',
  '      const detected = runCandidateDetection(activeEdgePoints, bounds, polygon, (diagnostics) => { detectorDiagnostics = diagnostics; }).map((candidate, index) => ({',
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
  '        source: detectionSource,',
  '        detectorDiagnostics',
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
  const next = insertAfterEdgeScannerButton(s, buttonBlock);
  if (!next) throw new Error('Could not find edge scanner button anchor.');
  s = next;
  changed = true;
}

const debugBlock = '\n              {detectionDebug && (\n                <p className="helperText">\n                  Debug: {detectionDebug.edgePoints.toLocaleString()} edges · {detectionDebug.candidateMasks} masks · {detectionDebug.polygonScoped ? "surface polygon scoped" : "full surface bounds"} · {detectionDebug.source}{detectionDebug.detectorDiagnostics ? ` · components ${detectionDebug.detectorDiagnostics.components} · rejected: closure ${detectionDebug.detectorDiagnostics.rejectedClosure}, size ${detectionDebug.detectorDiagnostics.rejectedSize}, aspect ${detectionDebug.detectorDiagnostics.rejectedAspect}, confidence ${detectionDebug.detectorDiagnostics.rejectedConfidence} · boundary penalties ${detectionDebug.detectorDiagnostics.boundaryPenalized}` : ""}\n                </p>\n              )}';

if (!s.includes('Debug: {detectionDebug.edgePoints.toLocaleString()} edges')) {
  const next = insertDebugHelper(s, debugBlock);
  if (next) {
    s = next;
    changed = true;
  } else {
    console.warn('Could not find mask helperText/debug anchor. Continuing without visible debug helper.');
  }
}

if (!changed) {
  console.log('No changes made. Auto detect masks UI patch may already be applied.');
} else {
  fs.writeFileSync(p, s);
  console.log('Applied auto detect masks UI patch.');
}
