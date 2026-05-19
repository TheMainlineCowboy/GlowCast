import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

s = s.replaceAll('Use Guided Edge Masks', 'Edge Masks Disabled');
s = s.replaceAll('Select Scanned Object', 'Edge Masks Disabled');
s = s.replaceAll('Selecting Scanned Object', 'Edge Masks Disabled');

const start = s.indexOf("  function createMasksFromEdges() {");
const end = s.indexOf("\n  async function toggleEdgeScanner() {", start);
if (start >= 0 && end > start) {
  s = s.slice(0, start) + [
    '  function createMasksFromEdges() {',
    '    setGuidedEdgeMode(false);',
    '    setDrawMode(false);',
    '    setDraftZone(null);',
    '    setDetectMessage("Edge-mask conversion is disabled while true scanner-path masks are rebuilt. The edge scanner itself is unchanged.");',
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
    '    setDraftZone(null);',
    '',
    '    if (guidedEdgeMode) {',
    '      setGuidedEdgeMode(false);',
    '      setDetectMessage("Guided rectangle masks are disabled. Use manual masks for now while true edge-path masks are rebuilt.");',
    '      return;',
    '    }',
    '',
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

writeFileSync(appPath, s);
