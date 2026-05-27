import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

source = source.replace(/Create Edge Masks/g, "Create Edge Mask Candidates");
source = source.replace('included: true,\n        label: "edge contour mask"', 'included: false,\n        label: "edge candidate"');
source = source.replace(/edge fallback mask/g, "edge candidate");

const resetAnchor = '  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {';
if (!source.includes('function applySelectedEdgeCandidate()')) {
  const helper = `  function applySelectedEdgeCandidate() {
    if (!selectedZone || selectedZone.label !== "edge candidate") {
      setDetectMessage("Select an edge candidate first.");
      return;
    }
    setZones((current) => current.map((zone) => zone.id === selectedZone.id ? { ...zone, included: true, label: "approved edge mask" } : zone));
    setDetectMessage("Applied selected edge candidate as a real mask.");
  }

  function clearEdgeCandidates() {
    setZones((current) => current.filter((zone) => zone.label !== "edge candidate"));
    if (selectedZone?.label === "edge candidate") setSelectedZoneId(null);
    setDetectMessage("Edge candidates cleared.");
  }

`;
  source = source.replace(resetAnchor, helper + resetAnchor);
}

writeFileSync(appPath, source);
