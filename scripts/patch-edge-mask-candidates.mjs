import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importLine = 'import { edgePointsToMaskCandidates } from "./core/edgeMaskCandidates";\n';
if (!source.includes("./core/edgeMaskCandidates")) {
  source = source.replace(
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n',
    'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n' + importLine
  );
}

if (!source.includes("function createMasksFromEdges")) {
  const anchor = "  async function toggleEdgeScanner() {";
  const helper = `  function createMasksFromEdges() {
    if (!edgePoints.length) {
      setDetectMessage("Run the edge scanner first, then create masks from detected edges.");
      return;
    }

    const sourceArea = projectionArea;
    const scopedEdgePoints = sourceArea
      ? edgePoints.filter((point) => point.x >= sourceArea.x && point.x <= sourceArea.x + sourceArea.width && point.y >= sourceArea.y && point.y <= sourceArea.y + sourceArea.height)
      : edgePoints;

    if (!scopedEdgePoints.length) {
      setDetectMessage("No scanned edge points were found inside the selected projection surface.");
      return;
    }

    const candidates = edgePointsToMaskCandidates(scopedEdgePoints, 14)
      .filter((candidate) => !sourceArea || (
        candidate.x >= sourceArea.x &&
        candidate.y >= sourceArea.y &&
        candidate.x + candidate.width <= sourceArea.x + sourceArea.width &&
        candidate.y + candidate.height <= sourceArea.y + sourceArea.height
      ));

    if (!candidates.length) {
      setDetectMessage("No strong edge regions were found inside the projection surface. Manual masks are still available.");
      return;
    }

    const baseId = Date.now();
    const generated = candidates.map((candidate, index) => ({
      id: baseId + index,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
      included: true,
      label: "Edge mask",
      confidence: candidate.confidence,
      shape: "rectangle" as MaskShape
    }));

    setZones((current) => [...current, ...generated]);
    setSelectedTarget("zone");
    setSelectedZoneId(generated[0]?.id ?? null);
    setProjectionOnly(false);
    setDrawMode(false);
    setDetectMessage("Created " + generated.length + " editable mask candidates inside the projection surface.");
  }

`;
  source = source.replace(anchor, helper + anchor);
}

if (!source.includes("Create Edge Masks")) {
  const target = '              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning}>{edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}</button>';
  const replacement = `${target}
              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || !edgePoints.length}>Create Edge Masks</button>`;
  source = source.replace(target, replacement);
}

writeFileSync(appPath, source);
