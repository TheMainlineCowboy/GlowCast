import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");
const start = source.indexOf("  function createMasksFromEdges() {");
const end = source.indexOf("\n  async function toggleEdgeScanner() {", start);

if (start >= 0 && end > start) {
  const replacement = [
    '  function createMasksFromEdges() {',
    '    if (!edgePoints.length) {',
    '      setDetectMessage("Run the edge scanner first, then create masks from detected edges.");',
    '      return;',
    '    }',
    '',
    '    const polygonBounds = surfacePolygonPoints.length >= 3',
    '      ? {',
    '          x: Math.min(...surfacePolygonPoints.map((point) => point.x)),',
    '          y: Math.min(...surfacePolygonPoints.map((point) => point.y)),',
    '          width: Math.max(...surfacePolygonPoints.map((point) => point.x)) - Math.min(...surfacePolygonPoints.map((point) => point.x)),',
    '          height: Math.max(...surfacePolygonPoints.map((point) => point.y)) - Math.min(...surfacePolygonPoints.map((point) => point.y))',
    '        }',
    '      : null;',
    '    const sourceArea = projectionArea ?? polygonBounds;',
    '',
    '    const insideArea = (point: { x: number; y: number }) => !sourceArea || (',
    '      point.x >= sourceArea.x &&',
    '      point.x <= sourceArea.x + sourceArea.width &&',
    '      point.y >= sourceArea.y &&',
    '      point.y <= sourceArea.y + sourceArea.height',
    '    );',
    '',
    '    const scopedEdgePoints = sourceArea ? edgePoints.filter(insideArea) : edgePoints;',
    '    if (!scopedEdgePoints.length) {',
    '      setDetectMessage("No scanned edge points were found inside the selected projection surface.");',
    '      return;',
    '    }',
    '',
    '    const candidates = edgePointsToMaskCandidates(scopedEdgePoints, 16).filter((candidate) => {',
    '      const center = { x: candidate.x + candidate.width / 2, y: candidate.y + candidate.height / 2 };',
    '      return insideArea(center);',
    '    });',
    '',
    '    if (!candidates.length) {',
    '      setDetectMessage("No usable edge mask candidates were created. The scanner is working, but the conversion layer needs tuning.");',
    '      return;',
    '    }',
    '',
    '    const baseId = Date.now();',
    '    const generated = candidates.map((candidate, index) => ({',
    '      id: baseId + index,',
    '      x: candidate.x,',
    '      y: candidate.y,',
    '      width: candidate.width,',
    '      height: candidate.height,',
    '      included: true,',
    '      label: "Edge mask",',
    '      confidence: candidate.confidence,',
    '      shape: "rectangle" as MaskShape',
    '    }));',
    '',
    '    setZones((current) => [...current.filter((zone) => zone.label !== "Edge mask"), ...generated]);',
    '    setSelectedTarget("zone");',
    '    setSelectedZoneId(generated[0]?.id ?? null);',
    '    setProjectionOnly(false);',
    '    setDrawMode(false);',
    '    setDetectMessage("Created " + generated.length + " editable edge mask candidates. Existing edge masks were replaced.");',
    '  }',
    ''
  ].join("\n");
  source = source.slice(0, start) + replacement + source.slice(end);
}

writeFileSync(appPath, source);
