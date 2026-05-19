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
    const usable = result.candidates
      .filter((candidate) => candidate.width >= 2 && candidate.height >= 2)
      .slice(0, 24)
      .map((candidate, index) => clampZone({
        id: Date.now() + index,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
        included: true,
        label: "edge mask",
        shape: "rectangle"
      }));
    if (!usable.length) {
      setDetectMessage("No usable edge masks found yet. Analyzer saw " + result.lines.length + " lines and " + result.candidates.length + " boxes.");
      return;
    }
    setZones((current) => [...current.filter((zone) => zone.label !== "edge mask"), ...usable]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setArchitecturalResult(result);
    setArchitecturalDebug(true);
    setDetectMessage("Created " + usable.length + " edge masks from scanned edges.");
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
