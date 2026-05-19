import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

const start = s.indexOf("  function createMasksFromEdges() {");
const end = s.indexOf("\n  async function toggleEdgeScanner() {", start);
if (start >= 0 && end > start) {
  s = s.slice(0, start) + [
    '  function createMasksFromEdges() {',
    '    if (!showEdges || !edgePoints.length) {',
    '      setDetectMessage("Run Show Edge Scanner first, then use guided edge masking.");',
    '      return;',
    '    }',
    '    setGuidedEdgeMode(true);',
    '    setDrawMode(false);',
    '    setDraftZone(null);',
    '    setProjectionOnly(false);',
    '    setCornerMode(false);',
    '    setCornerPoints([]);',
    '    setSurfacePolygonMode(false);',
    '    setDetectMessage("Guided edge mode: drag a box around one scanner-detected window or object. Taps are ignored.");',
    '  }',
    ''
  ].join("\n") + s.slice(end);
}

const finishStart = s.indexOf("  function finishPointerAction() {");
const finishEnd = s.indexOf("\n\n  async function openProjectorMode()", finishStart);
if (finishStart >= 0 && finishEnd > finishStart) {
  s = s.slice(0, finishStart) + [
    '  function finishPointerAction() {',
    '    setResizeAction(null);',
    '',
    '    if (!draftZone) return;',
    '    const rect = normalizeDraftZone(draftZone);',
    '',
    '    if (guidedEdgeMode) {',
    '      if (rect.width >= 5 && rect.height >= 5) {',
    '        createGuidedEdgeMaskFromDraft(draftZone);',
    '      } else {',
    '        setDetectMessage("Guided edge mode needs a real drag box. Taps are ignored.");',
    '      }',
    '      setGuidedEdgeMode(false);',
    '      setDraftZone(null);',
    '      return;',
    '    }',
    '',
    '    setDraftZone(null);',
    '    if (rect.width < 2 || rect.height < 2) return;',
    '    const id = Date.now();',
    '    setZones((current) => [',
    '      ...current,',
    '      { id, ...rect, included: true, label: `manual ${draftZone.shape} avoid zone` }',
    '    ]);',
    '    setSelectedTarget("zone");',
    '    setSelectedZoneId(id);',
    '  }'
  ].join("\n") + s.slice(finishEnd);
}

s = s.replaceAll('Create Edge Masks', 'Use Guided Edge Masks');

writeFileSync(appPath, s);
