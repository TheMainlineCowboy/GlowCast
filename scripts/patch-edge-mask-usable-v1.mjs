import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

if (!source.includes("function zonePointClipPath")) {
  const anchor = "  function createMasksFromEdges() {";
  const helper = [
    '  function zonePointClipPath(zone: ProjectZone) {',
    '    if (!zone.points || zone.points.length < 3) return undefined;',
    '    const points = zone.points.map((point) => {',
    '      const localX = zone.width > 0 ? ((point.x - zone.x) / zone.width) * 100 : 0;',
    '      const localY = zone.height > 0 ? ((point.y - zone.y) / zone.height) * 100 : 0;',
    '      return clamp(localX) + "% " + clamp(localY) + "%";',
    '    });',
    '    return "polygon(" + points.join(",") + ")";',
    '  }',
    ''
  ].join("\n");
  source = source.replace(anchor, helper + anchor);
}

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
    '    const candidates = edgePointsToMaskCandidates(edgePoints, 16);',
    '    if (!candidates.length) {',
    '      setDetectMessage("No usable edge contours were created yet. The scanner is working, but no closed/mostly closed paths were found.");',
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
    '      points: candidate.points,',
    '      shape: candidate.points && candidate.points.length >= 3 ? "freehand" as MaskShape : "rectangle" as MaskShape',
    '    }));',
    '',
    '    setZones((current) => [...current.filter((zone) => zone.label !== "Edge mask"), ...generated]);',
    '    setSelectedTarget("zone");',
    '    setSelectedZoneId(generated[0]?.id ?? null);',
    '    setProjectionOnly(false);',
    '    setDrawMode(false);',
    '    setDetectMessage("Created " + generated.length + " topology-based edge mask candidates. Existing generated edge masks were replaced.");',
    '  }',
    ''
  ].join("\n");
  source = source.slice(0, start) + replacement + source.slice(end);
}

source = source.replaceAll('clipPath: `polygon(${zone.points.map((p) => `${p.x}% ${p.y}%`).join(",")})`', 'clipPath: zonePointClipPath(zone)');

writeFileSync(appPath, source);
