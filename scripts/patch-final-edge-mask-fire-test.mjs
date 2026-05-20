import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

if (!s.includes('function createMasksFromEdges()')) {
  s = s.replace('  function addZone(shape: MaskShape = drawShape) {', `  function createMasksFromEdges() {
    const base = projectionArea ?? defaultSurface();
    const testZone = clampZone({
      id: Date.now() + 777,
      x: base.x + base.width * 0.25,
      y: base.y + base.height * 0.25,
      width: base.width * 0.5,
      height: base.height * 0.45,
      included: true,
      label: "edge mask",
      shape: "rectangle"
    });
    setZones([testZone]);
    setSelectedTarget("zone");
    setSelectedZoneId(testZone.id);
    setDrawMode(false);
    setProjectionOnly(false);
    setShowEdges(false);
    setArchitecturalDebug(false);
    setDetectMessage("EDGE MASK BUTTON FIRED - zone count should be 1.");
  }

  function addZone(shape: MaskShape = drawShape) {`);
}

s = s.replace(/<button type="button"[^>]*>\s*(Create Edge Masks|Edge Masks Disabled|FIRE TEST EDGE MASKS)\s*<\/button>/g, '');

const fireButton = `
              <button type="button" className="primary" onClick={createMasksFromEdges} disabled={!imageUrl}>
                FIRE TEST EDGE MASKS
              </button>
              <p className="helperText">Zone count: {zones.length}</p>`;

if (!s.includes('FIRE TEST EDGE MASKS')) {
  const marker = `              <button type="button" onClick={analyzeArchitecturalCandidates} disabled={!showEdges || !edgePoints.length || projectionOnly}>
                Analyze Structural Candidates
              </button>`;
  if (s.includes(marker)) {
    s = s.replace(marker, fireButton + "\n" + marker);
  } else {
    const snapMarker = `              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>`;
    s = s.replace(snapMarker, fireButton + "\n" + snapMarker);
  }
}

writeFileSync(p, s);
