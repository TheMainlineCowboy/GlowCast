import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

source = source.replace(
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
  'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";'
);

if (!source.includes("function createMasksFromEdges()")) {
  source = source.replace(
    "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {",
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

  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {`
  );
}

if (!source.includes("Create Edge Masks")) {
  source = source.replace(
    `              <label className="flex items-center gap-2 text-sm text-slate-200">`,
    `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-200">`
  );
}

writeFileSync(path, source);
