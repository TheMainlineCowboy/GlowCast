import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

if (!s.includes('function createMasksFromEdges()')) {
  s = s.replace('  function addZone(shape: MaskShape = drawShape) {', `  function createMasksFromEdges() {
    const base = projectionArea ?? defaultSurface();
    const fallback = [
      clampZone({ id: Date.now() + 1001, x: base.x + base.width * 0.18, y: base.y + base.height * 0.34, width: base.width * 0.24, height: base.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1002, x: base.x + base.width * 0.55, y: base.y + base.height * 0.34, width: base.width * 0.24, height: base.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1003, x: base.x + base.width * 0.34, y: base.y + base.height * 0.14, width: base.width * 0.30, height: base.height * 0.18, included: true, label: "edge mask", shape: "rectangle" })
    ];
    setZones((current) => [...current.filter((zone) => zone.label !== "edge mask"), ...fallback]);
    setSelectedTarget("zone");
    setSelectedZoneId(fallback[0].id);
    setDrawMode(false);
    setProjectionOnly(false);
    setDetectMessage("EDGE MASK BUTTON FIRED: created 3 test masks.");
  }

  function addZone(shape: MaskShape = drawShape) {`);
}

s = s.replaceAll('Edge Masks Disabled', 'Create Edge Masks');
s = s.replace(/<button type="button"[^>]*>\s*Create Edge Masks\s*<\/button>/g, '');

const fireButton = `
              <button type="button" className="primary" onClick={createMasksFromEdges} disabled={!imageUrl}>
                FIRE TEST EDGE MASKS
              </button>`;

if (!s.includes('FIRE TEST EDGE MASKS')) {
  const marker = `              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>`;
  if (s.includes(marker)) s = s.replace(marker, fireButton + "\n" + marker);
}

writeFileSync(p, s);
