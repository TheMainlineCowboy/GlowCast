import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

function replaceOnce(from, to, label) {
  if (!app.includes(from)) return false;
  app = app.replace(from, to);
  return true;
}

replaceOnce(
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
  'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type AutoMaskZone, type EdgePoint } from "./edgeDetect";',
  "edge import"
);

replaceOnce(
  '  const [snapEnabled, setSnapEnabled] = useState(true);',
  '  const [snapEnabled, setSnapEnabled] = useState(true);\n  const [edgeOnlyMode, setEdgeOnlyMode] = useState(false);',
  "edge only state"
);

replaceOnce(
  '  const projectionArea = surfaceZone;',
  [
    '  const polygonProjectionArea = useMemo<Zone | null>(() => {',
    '    if (!surfacePolygonClosed || surfacePolygonPoints.length < 3) return null;',
    '    const xs = surfacePolygonPoints.map((point) => point.x);',
    '    const ys = surfacePolygonPoints.map((point) => point.y);',
    '    const minX = Math.min(...xs);',
    '    const maxX = Math.max(...xs);',
    '    const minY = Math.min(...ys);',
    '    const maxY = Math.max(...ys);',
    '    return clampZone({',
    '      id: -1,',
    '      x: minX,',
    '      y: minY,',
    '      width: maxX - minX,',
    '      height: maxY - minY,',
    '      included: true,',
    '      label: "projection surface"',
    '    });',
    '  }, [surfacePolygonClosed, surfacePolygonPoints]);',
    '',
    '  const projectionArea = surfaceZone ?? polygonProjectionArea;'
  ].join("\n"),
  "polygon projection area"
);

replaceOnce(
  '    setSnapEnabled(true);\n  }',
  '    setSnapEnabled(true);\n    setEdgeOnlyMode(false);\n  }',
  "reset edge only"
);

const helperFunctions = [
  '',
  '  function edgeCandidateZones() {',
  '    return zones.filter((zone) => zone.label === "edge candidate");',
  '  }',
  '',
  '  function autoMaskToZone(mask: AutoMaskZone, index: number): ProjectZone {',
  '    const box = mask.boundingBox;',
  '    const relativePoints = mask.points.map((point) => ({',
  '      x: Number(clamp(((point.x - box.x) / Math.max(box.width, 0.01)) * 100).toFixed(2)),',
  '      y: Number(clamp(((point.y - box.y) / Math.max(box.height, 0.01)) * 100).toFixed(2))',
  '    }));',
  '    return {',
  '      id: Date.now() + index,',
  '      x: box.x,',
  '      y: box.y,',
  '      width: box.width,',
  '      height: box.height,',
  '      included: false,',
  '      label: "edge candidate",',
  '      shape: "freehand",',
  '      points: relativePoints.length >= 3 ? relativePoints : undefined',
  '    };',
  '  }',
  '',
  '  async function ensureEdgeScan() {',
  '    if (!imageUrl) return null;',
  '    if (edgePoints.length && edgeOverlayUrl) return { edgePoints, edgeCanvasUrl: edgeOverlayUrl };',
  '    setEdgeScanning(true);',
  '    const result = await scanImageEdges(imageUrl);',
  '    setEdgeOverlayUrl(result.edgeCanvasUrl);',
  '    setEdgePoints(result.edgePoints);',
  '    setShowEdges(true);',
  '    setEdgeScanning(false);',
  '    return result;',
  '  }',
  '',
  '  async function createEdgeMaskCandidates() {',
  '    if (!projectionArea || !imageUrl) {',
  '      setDetectMessage("Draw or close the projection surface first, then create edge masks.");',
  '      return;',
  '    }',
  '    try {',
  '      setDetectMessage("Reading enclosed shapes from the edge layer...");',
  '      const result = await ensureEdgeScan();',
  '      if (!result) return;',
  '      const masks = generateAutoMasks(result.edgePoints, projectionArea);',
  '      const nextCandidates = masks.map(autoMaskToZone);',
  '      setZones((current) => [',
  '        ...current.filter((zone) => zone.label !== "edge candidate"),',
  '        ...nextCandidates',
  '      ]);',
  '      if (nextCandidates.length) {',
  '        setSelectedTarget("zone");',
  '        setSelectedZoneId(nextCandidates[0].id);',
  '        setDetectMessage("Created " + nextCandidates.length + " selectable edge mask candidate" + (nextCandidates.length === 1 ? "" : "s") + ".");',
  '      } else {',
  '        setSelectedTarget("surface");',
  '        setSelectedZoneId(null);',
  '        setDetectMessage("No enclosed edge candidates found. Edge-only View can still be used with manual masks and magnetic snap.");',
  '      }',
  '    } catch (error) {',
  '      setDebugWarnings([error instanceof Error ? error.message : "Edge mask creation failed."]);',
  '      setDetectMessage("Edge mask creation failed. You can still draw masks manually with magnetic snap.");',
  '      setEdgeScanning(false);',
  '    }',
  '  }',
  '',
  '  function applySelectedEdgeCandidate() {',
  '    if (!selectedZoneId) {',
  '      setDetectMessage("Select an edge candidate first.");',
  '      return;',
  '    }',
  '    setZones((current) => current.map((zone) => zone.id === selectedZoneId ? { ...zone, included: true, label: "approved edge mask" } : zone));',
  '    setDetectMessage("Applied selected edge candidate as a real mask.");',
  '  }',
  '',
  '  function applyAllEdgeCandidates() {',
  '    const candidates = edgeCandidateZones();',
  '    if (!candidates.length) {',
  '      setDetectMessage("No edge candidates to apply.");',
  '      return;',
  '    }',
  '    setZones((current) => current.map((zone) => zone.label === "edge candidate" ? { ...zone, included: true, label: "approved edge mask" } : zone));',
  '    setDetectMessage("Applied " + candidates.length + " edge candidate" + (candidates.length === 1 ? "" : "s") + " as real masks.");',
  '  }',
  '',
  '  function clearEdgeCandidates() {',
  '    setZones((current) => current.filter((zone) => zone.label !== "edge candidate"));',
  '    setSelectedTarget("surface");',
  '    setSelectedZoneId(null);',
  '    setDetectMessage("Cleared edge candidates.");',
  '  }',
  '',
  '  async function toggleEdgeOnlyMode() {',
  '    if (!imageUrl) return;',
  '    if (edgeOnlyMode) {',
  '      setEdgeOnlyMode(false);',
  '      return;',
  '    }',
  '    try {',
  '      await ensureEdgeScan();',
  '      setEdgeOnlyMode(true);',
  '      setShowEdges(true);',
  '      setProjectionOnly(false);',
  '      setDetectMessage("Showing only the scanned edge layer.");',
  '    } catch (error) {',
  '      setDebugWarnings([error instanceof Error ? error.message : "Edge-only view failed."]);',
  '      setDetectMessage("Edge-only view failed.");',
  '      setEdgeScanning(false);',
  '    }',
  '  }',
  ''
].join("\n");

if (!app.includes("function createEdgeMaskCandidates()")) {
  replaceOnce('\n  function resetForPhoto', helperFunctions + '\n  function resetForPhoto', "edge helpers");
}

replaceOnce(
  '          {imageUrl && (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          )}',
  '          {edgeOnlyMode && edgeOverlayUrl ? (\n            <img className="referencePhoto edgeOnlyStage" src={edgeOverlayUrl} alt="Scanned edge layer" draggable={false} />\n          ) : imageUrl ? (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          ) : null}',
  "edge-only image"
);

app = app.replace('          {showEdges && edgeOverlayUrl && !projectionOnly ? (', '          {showEdges && edgeOverlayUrl && !projectionOnly && !edgeOnlyMode ? (');
app = app.replace('          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}', '          {surfacePolygonClosed && projectionOnly ? renderPolygonProjectionLayer() : null}');
app = app.replaceAll('!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map', '!projectionOnly && !edgeOnlyMode && !cornerMode && !surfacePolygonMode && zones.map');
app = app.replaceAll('projectionArea && showSurfaceHandles && !projectionOnly', 'projectionArea && showSurfaceHandles && !projectionOnly && !edgeOnlyMode');
app = app.replaceAll('invertMode && projectionArea && !surfacePolygonClosed && (', 'invertMode && projectionArea && !edgeOnlyMode && !surfacePolygonClosed && (');
app = app.replaceAll('draftRect && !projectionOnly', 'draftRect && !projectionOnly && !edgeOnlyMode');

const edgeButtons = [
  '              <button type="button" onClick={toggleEdgeOnlyMode} disabled={!imageUrl || edgeScanning}>',
  '                {edgeOnlyMode ? "Show Photo View" : "Edge-only View"}',
  '              </button>',
  '              <button type="button" onClick={createEdgeMaskCandidates} disabled={!imageUrl || !projectionArea || edgeScanning}>',
  '                Create Edge Mask Candidates',
  '              </button>',
  '              <button className="primary" onClick={applySelectedEdgeCandidate} disabled={selectedZone?.label !== "edge candidate"}>',
  '                Apply Selected Candidate',
  '              </button>',
  '              <button type="button" onClick={applyAllEdgeCandidates} disabled={!edgeCandidateZones().length}>',
  '                Apply All Candidates',
  '              </button>',
  '              <button type="button" onClick={clearEdgeCandidates} disabled={!edgeCandidateZones().length}>',
  '                Clear Candidates',
  '              </button>'
].join("\n");

if (!app.includes("Create Edge Mask Candidates")) {
  replaceOnce(
    '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>',
    edgeButtons + '\n              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>',
    "edge buttons"
  );
}

app = app.replace(
  '                  <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />',
  '                  {zone.points && zone.points.length >= 3 ? (\n                    <polygon points={zone.points.map((point) => point.x + "," + point.y).join(" ")} />\n                  ) : (\n                    <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />\n                  )}'
);

writeFileSync(appPath, app);
console.log("final edge flow patch applied");
