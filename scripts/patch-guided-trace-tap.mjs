import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

const anchor = "  async function createEdgeMaskCandidates() {";
if (!app.includes("function traceLocalEdgeMask")) {
  app = app.replace(anchor, `  function traceLocalEdgeMask(point: Point) {
    if (!projectionArea || !edgePoints.length) return;
    const local = edgePoints.filter((edge) => edge.strength >= 58 && Math.abs(edge.x - point.x) <= 10 && Math.abs(edge.y - point.y) <= 10 && edge.x >= projectionArea.x && edge.x <= projectionArea.x + projectionArea.width && edge.y >= projectionArea.y && edge.y <= projectionArea.y + projectionArea.height);
    if (local.length < 6) { setDetectMessage("No usable edge group found there. Tap closer to the visible outline."); return; }
    const xs = local.map((edge) => edge.x);
    const ys = local.map((edge) => edge.y);
    const left = Math.max(projectionArea.x, Math.min(...xs) - 1.2);
    const top = Math.max(projectionArea.y, Math.min(...ys) - 1.2);
    const right = Math.min(projectionArea.x + projectionArea.width, Math.max(...xs) + 1.2);
    const bottom = Math.min(projectionArea.y + projectionArea.height, Math.max(...ys) + 1.2);
    const id = Date.now();
    const zone = clampZone({ id, x: left, y: top, width: right - left, height: bottom - top, included: false, label: "edge trace candidate", shape: "rectangle" });
    if (zone.width < 2 || zone.height < 2) { setDetectMessage("Trace was too small. Tap closer to the full outline."); return; }
    setZones((current) => [...current.filter((item) => item.label !== "edge trace candidate"), zone]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDetectMessage("Traced one local edge mask candidate. Adjust it, then apply it if it looks right.");
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
