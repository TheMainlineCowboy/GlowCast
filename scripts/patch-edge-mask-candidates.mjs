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

    const candidates = edgePointsToMaskCandidates(edgePoints, 16);
    if (!candidates.length) {
      setDetectMessage("No strong edge regions were found for automatic masks. Manual masks are still available.");
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
    setDetectMessage(`Created ${generated.length} editable mask candidates from scanned edges. Tap a mask to adjust or disable it.`);
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
