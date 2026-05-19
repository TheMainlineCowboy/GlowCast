import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

s = s.replace(
  '  const [snapEnabled, setSnapEnabled] = useState(true);',
  '  const [snapEnabled, setSnapEnabled] = useState(true);\n  const [guidedEdgeMode, setGuidedEdgeMode] = useState(false);'
);

if (!s.includes("function createGuidedEdgeMaskFromDraft")) {
  s = s.replace('  function createMasksFromEdges() {', `  function createGuidedEdgeMaskFromDraft(draft: DraftZone) {
    const userBounds = normalizeDraftZone(draft);
    if (userBounds.width < 2 || userBounds.height < 2) return false;
    if (!edgePoints.length) {
      setDetectMessage("Run the edge scanner first, then drag around one detected object.");
      return false;
    }
    const pointsInside = edgePoints.filter((point) => point.x >= userBounds.x && point.x <= userBounds.x + userBounds.width && point.y >= userBounds.y && point.y <= userBounds.y + userBounds.height);
    if (!pointsInside.length) {
      setDetectMessage("No scanner edge points were found inside that selection. Try drawing closer around the highlighted scanner lines.");
      return false;
    }
    const strengths = pointsInside.map((point) => point.strength).sort((a, b) => a - b);
    const threshold = Math.max(35, strengths[Math.floor(strengths.length * 0.35)] ?? 35);
    const strongPoints = pointsInside.filter((point) => point.strength >= threshold);
    const local = strongPoints.length >= 4 ? strongPoints : pointsInside;
    const minX = Math.min(...local.map((point) => point.x));
    const maxX = Math.max(...local.map((point) => point.x));
    const minY = Math.min(...local.map((point) => point.y));
    const maxY = Math.max(...local.map((point) => point.y));
    const pad = 0.9;
    const x = clamp(minX - pad);
    const y = clamp(minY - pad);
    const width = clamp(maxX - minX + pad * 2, 0, 100 - x);
    const height = clamp(maxY - minY + pad * 2, 0, 100 - y);
    if (width < 2 || height < 2) {
      setDetectMessage("That scanner selection was too small to become a mask.");
      return false;
    }
    const id = Date.now();
    setZones((current) => [...current, clampZone({ id, x, y, width, height, included: true, label: "Guided edge mask", shape: "rectangle" as MaskShape })]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setProjectionOnly(false);
    setDetectMessage("Created a guided edge mask from " + local.length + " scanner edge points.");
    return true;
  }

  function createMasksFromEdges() {`);
}

s = s.replace(
  '    if (\n      !imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone,.projectionBoundary")\n    ) {',
  '    if (guidedEdgeMode && imageUrl && !projectionOnly && !(event.target as HTMLElement).closest(".zone,.projectionBoundary")) {\n      const point = getPoint(event, false);\n      if (!point) return;\n      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);\n      setSelectedTarget("zone");\n      setSelectedZoneId(null);\n      setDraftZone({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y, shape: "rectangle" });\n      return;\n    }\n    if (\n      !imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone,.projectionBoundary")\n    ) {'
);

s = s.replace(
  '    if (!draftZone || !drawMode || projectionOnly || cornerMode || surfacePolygonMode) return;',
  '    if (!draftZone || projectionOnly || cornerMode || surfacePolygonMode) return;\n    if (!drawMode && !guidedEdgeMode) return;'
);

s = s.replace(
  '    if (!draftZone) return;\n    const rect = normalizeDraftZone(draftZone);\n    setDraftZone(null);\n    if (rect.width < 2 || rect.height < 2) return;',
  '    if (!draftZone) return;\n    const rect = normalizeDraftZone(draftZone);\n    if (guidedEdgeMode) {\n      createGuidedEdgeMaskFromDraft(draftZone);\n      setGuidedEdgeMode(false);\n      setDraftZone(null);\n      return;\n    }\n    setDraftZone(null);\n    if (rect.width < 2 || rect.height < 2) return;'
);

s = s.replace('`manual ${activeDraft.shape} avoid zone`', '`manual ${draftZone.shape} avoid zone`');

s = s.replace(
  '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>',
  '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>\n              <button type="button" onClick={() => { setGuidedEdgeMode((value) => !value); setDrawMode(false); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); setDetectMessage("Drag around one scanner-detected window or object. The mask will tighten to edge points inside your selection."); }} disabled={!imageUrl || !showEdges || !edgePoints.length} className={guidedEdgeMode ? "activeStep" : ""} >\n                {guidedEdgeMode ? "Selecting Scanned Object" : "Select Scanned Object"}\n              </button>'
);

s = s.replace(
  'cornerMode ? `Corner ${Math.min(cornerPoints.length + 1, 4)} of 4: ${cornerNames[cornerPoints.length] ?? "complete"}` : drawMode ? `Drag directly on the photo to draw a ${drawShape} avoid mask.` : detectMessage',
  'cornerMode ? `Corner ${Math.min(cornerPoints.length + 1, 4)} of 4: ${cornerNames[cornerPoints.length] ?? "complete"}` : guidedEdgeMode ? "Drag around one scanner-detected object to create a tightened edge mask." : drawMode ? `Drag directly on the photo to draw a ${drawShape} avoid mask.` : detectMessage'
);

writeFileSync(appPath, s);
