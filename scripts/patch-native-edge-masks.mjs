import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const oldImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
const newImport = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';

if (source.includes(oldImport)) {
  source = source.replace(oldImport, newImport);
} else if (!source.includes(newImport)) {
  throw new Error("Native edge mask patch failed: edgeDetect import anchor was not found.");
}

if (!source.includes("function createMasksFromEdges()")) {
  const functionAnchor = "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {";

  if (!source.includes(functionAnchor)) {
    throw new Error("Native edge mask patch failed: resetForPhoto anchor was not found.");
  }

  source = source.replace(
    functionAnchor,
    `  function createMasksFromEdges() {
    if (!edgePoints.length) {
      setDetectMessage("Run the Edge Scanner first, then create edge masks.");
      return;
    }

    const bounds = projectionArea ?? { x: 0, y: 0, width: 100, height: 100 };
    const autoMasks = generateAutoMasks(edgePoints, bounds, {
      clusterRadius: 1.6,
      minPoints: 18,
      tolerance: 0.8
    });

    const usable = autoMasks
      .map((mask, index) => clampZone({
        id: Date.now() + index,
        x: mask.boundingBox.x,
        y: mask.boundingBox.y,
        width: mask.boundingBox.width,
        height: mask.boundingBox.height,
        included: true,
        label: "edge mask",
        shape: "rectangle" as MaskShape
      }))
      .filter((zone) => zone.width >= 2 && zone.height >= 2)
      .slice(0, 24);

    if (!usable.length) {
      setDetectMessage("No usable edge masks found yet. Try scanning a clearer wall photo or setting a projection surface first.");
      return;
    }

    setZones((current) => [
      ...current.filter((zone) => zone.label !== "edge mask"),
      ...usable
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setDetectMessage("Created " + usable.length + " edge masks from scanned edges.");
  }

${functionAnchor}`
  );
}

if (!source.includes("Create Edge Masks")) {
  const buttonAnchor = `              <label className="flex items-center gap-2 text-sm text-slate-200">`;

  if (!source.includes(buttonAnchor)) {
    throw new Error("Native edge mask patch failed: magnetic snap label anchor was not found.");
  }

  source = source.replace(
    buttonAnchor,
    `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>
${buttonAnchor}`
  );
}

writeFileSync(path, source);
