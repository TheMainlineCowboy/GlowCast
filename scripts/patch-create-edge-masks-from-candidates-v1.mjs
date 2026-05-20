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
    const base = polygon ? {
      x: Math.min(...polygon.map((point) => point.x)),
      y: Math.min(...polygon.map((point) => point.y)),
      width: Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)),
      height: Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y))
    } : projectionArea ?? defaultSurface();

    const cell = Math.max(3, Math.min(base.width, base.height) * 0.12);
    const buckets = new Map<string, EdgePoint[]>();
    for (const point of edgePoints) {
      if (point.x < base.x || point.x > base.x + base.width || point.y < base.y || point.y > base.y + base.height) continue;
      const key = Math.floor((point.x - base.x) / cell) + ":" + Math.floor((point.y - base.y) / cell);
      const list = buckets.get(key) ?? [];
      list.push(point);
      buckets.set(key, list);
    }

    const zonesFromBuckets = Array.from(buckets.values())
      .filter((list) => list.length >= 2)
      .sort((a, b) => b.length - a.length)
      .slice(0, 12)
      .map((list, index) => {
        const xs = list.map((point) => point.x);
        const ys = list.map((point) => point.y);
        const padX = Math.max(2.5, base.width * 0.035);
        const padY = Math.max(2.5, base.height * 0.035);
        return clampZone({
          id: Date.now() + index,
          x: Math.min(...xs) - padX,
          y: Math.min(...ys) - padY,
          width: Math.max(...xs) - Math.min(...xs) + padX * 2,
          height: Math.max(...ys) - Math.min(...ys) + padY * 2,
          included: true,
          label: "edge mask",
          shape: "rectangle"
        });
      });

    const fallback = [
      clampZone({ id: Date.now() + 1001, x: base.x + base.width * 0.18, y: base.y + base.height * 0.34, width: base.width * 0.24, height: base.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1002, x: base.x + base.width * 0.55, y: base.y + base.height * 0.34, width: base.width * 0.24, height: base.height * 0.22, included: true, label: "edge mask", shape: "rectangle" }),
      clampZone({ id: Date.now() + 1003, x: base.x + base.width * 0.34, y: base.y + base.height * 0.14, width: base.width * 0.30, height: base.height * 0.18, included: true, label: "edge mask", shape: "rectangle" })
    ];

    const usable = zonesFromBuckets.length ? zonesFromBuckets : fallback;
    setZones((current) => [...current.filter((zone) => zone.label !== "edge mask"), ...usable]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setDetectMessage("Created " + usable.length + " edge masks from " + edgePoints.length + " scanner points.");
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
