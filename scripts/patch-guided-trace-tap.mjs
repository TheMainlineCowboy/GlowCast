import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

const anchor = "  async function createEdgeMaskCandidates() {";
if (!app.includes("function traceLocalEdgeMask")) {
  app = app.replace(anchor, `  function traceLocalEdgeMask(point: Point) {
    if (!projectionArea || !edgePoints.length) return;
    const edgeHitRadius = 1.15;
    const localRadius = 4.5;
    const eligible = edgePoints.filter((edge) => edge.strength >= 70 && edge.x >= projectionArea.x && edge.x <= projectionArea.x + projectionArea.width && edge.y >= projectionArea.y && edge.y <= projectionArea.y + projectionArea.height);
    const hit = eligible.filter((edge) => Math.hypot(edge.x - point.x, edge.y - point.y) <= edgeHitRadius);
    if (hit.length < 2) { setDetectMessage("Tap directly on a cyan edge line, not inside the opening."); return; }
    const local = eligible.filter((edge) => Math.hypot(edge.x - point.x, edge.y - point.y) <= localRadius);
    if (local.length < 6) { setDetectMessage("Not enough connected edge points there. Tap another part of the outline."); return; }
    const xs = local.map((edge) => edge.x);
    const ys = local.map((edge) => edge.y);
    const left = Math.max(projectionArea.x, Math.min(...xs) - 0.7);
    const top = Math.max(projectionArea.y, Math.min(...ys) - 0.7);
    const right = Math.min(projectionArea.x + projectionArea.width, Math.max(...xs) + 0.7);
    const bottom = Math.min(projectionArea.y + projectionArea.height, Math.max(...ys) + 0.7);
    const id = Date.now();
    const zone: ProjectZone = clampZone({ id, x: left, y: top, width: right - left, height: bottom - top, included: false, label: "edge trace candidate", shape: "rectangle" as MaskShape });
    if (zone.width < 1.2 || zone.height < 1.2) { setDetectMessage("Trace was too small. Tap on a longer section of the outline."); return; }
    setZones((current) => [...current.filter((item) => item.label !== "edge trace candidate"), zone]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDetectMessage("Traced edge line under your tap. If it is too small, tap another edge section or use manual adjust.");
  }

${anchor}`);
}

const pointerAnchor = "    if (\n      !imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(\".zone,.projectionBoundary\")\n    ) {";
if (!app.includes("traceLocalEdgeMask(point);")) {
  app = app.replace(pointerAnchor, `    if (edgeTraceMode && imageUrl && !projectionOnly && !(event.target as HTMLElement).closest(".zone,.projectionBoundary")) {
      const point = getPoint(event, false);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      traceLocalEdgeMask(point);
      return;
    }

${pointerAnchor}`);
}

writeFileSync(appPath, app);
console.log("guided trace tap behavior added");
