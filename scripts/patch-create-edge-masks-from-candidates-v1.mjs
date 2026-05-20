import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

if (!s.includes('function createMasksFromEdges()')) {
  s = s.replace('  function addZone(shape: MaskShape = drawShape) {', `  function createMasksFromEdges() {
    if (!edgePoints.length) {
      setDetectMessage("Run the Edge Scanner first, then create edge masks.");
      return;
    }
    const polygon = surfacePolygonClosed && surfacePolygonPoints.length >= 3 ? surfacePolygonPoints : null;
    const bounds = polygon ? {
      x: Math.min(...polygon.map((point) => point.x)),
      y: Math.min(...polygon.map((point) => point.y)),
      width: Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)),
      height: Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y))
    } : projectionArea;
    const result = detectArchitecturalCandidates(edgePoints, { bounds, polygon });
    const fromCandidates = result.candidates
      .filter((candidate) => candidate.width >= 1.5 && candidate.height >= 1.5)
      .slice(0, 24)
      .map((candidate, index) => clampZone({
        id: Date.now() + index,
        x: candidate.x,
        y: candidate.y,
        width: Math.max(3, candidate.width),
        height: Math.max(3, candidate.height),
        included: true,
        label: "edge mask",
        shape: "rectangle"
      }));
    const fallbackBase = bounds ?? projectionArea ?? defaultSurface();
    const fallback = [
      clampZone({ id: Date.now() + 1001, x: fallbackBase.x + fallbackBase.width * 0.18, y: fallbackBase.y + fallbackBase.height * 0.34, width: fallbackBase.width * 0.24, height: fallbackBase.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1002, x: fallbackBase.x + fallbackBase.width * 0.55, y: fallbackBase.y + fallbackBase.height * 0.34, width: fallbackBase.width * 0.24, height: fallbackBase.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1003, x: fallbackBase.x + fallbackBase.width * 0.34, y: fallbackBase.y + fallbackBase.height * 0.14, width: fallbackBase.width * 0.30, height: fallbackBase.height * 0.18, included: true, label: "edge mask", shape: "rectangle" })
    ];
    const usable = fromCandidates.length ? fromCandidates : fallback;
    setZones((current) => [...current.filter((zone) => zone.label !== "edge mask"), ...usable]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setArchitecturalResult(result);
    setArchitecturalDebug(true);
    setDetectMessage("Created " + usable.length + " edge masks. Analyzer saw " + result.lines.length + " lines and " + result.candidates.length + " boxes.");
  }

  function addZone(shape: MaskShape = drawShape) {`);
}

s = s.replaceAll('Edge Masks Disabled', 'Create Edge Masks');

const createButton = `
              <button type="button" onClick={createMasksFromEdges} disabled={!showEdges || !edgePoints.length || projectionOnly}>
                Create Edge Masks
              </button>`;

if (!s.includes('onClick={createMasksFromEdges}')) {
  const marker = `              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>`;
  if (s.includes(marker)) {
    s = s.replace(marker, createButton + "\n" + marker);
  }
}

s = s.replace(/<button type="button" onClick=\{[^}]+\} disabled=\{!imageUrl\}\>\s*Create Edge Masks\s*<\/button>/g, '<button type="button" onClick={createMasksFromEdges} disabled={!showEdges || !edgePoints.length || projectionOnly}>\n                Create Edge Masks\n              </button>');
s = s.replace(/<button type="button" onClick=\{createMasksFromEdges\} disabled=\{!imageUrl\}\>\s*Create Edge Masks\s*<\/button>/g, '<button type="button" onClick={createMasksFromEdges} disabled={!showEdges || !edgePoints.length || projectionOnly}>\n                Create Edge Masks\n              </button>');

writeFileSync(p, s);
