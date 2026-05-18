import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const edgeImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\n';
const helperImport = 'import { createTapMaskZone } from "./manualMaskTapFix";\n';

if (!text.includes(helperImport)) {
  if (!text.includes(edgeImport)) {
    throw new Error("Could not find edgeDetect import anchor for manual mask drawing patch.");
  }
  text = text.replace(edgeImport, edgeImport + helperImport);
}

const oldFinish = `  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);
    if (rect.width < 2 || rect.height < 2) return;
    const id = Date.now();
    setZones((current) => [
      ...current,
      { id, ...rect, included: true, label: \`manual \${draftZone.shape} avoid zone\` }
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
  }
`;

const newFinish = `  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    const zone = rect.width < 2 || rect.height < 2
      ? createTapMaskZone(draftZone.startX, draftZone.startY, draftZone.shape)
      : rect;
    setDraftZone(null);
    const id = Date.now();
    setZones((current) => [
      ...current,
      { id, ...zone, included: true, label: \`manual \${draftZone.shape} avoid zone\` }
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
  }
`;

if (!text.includes(newFinish)) {
  if (!text.includes(oldFinish)) {
    throw new Error("Could not find finishPointerAction block for manual mask drawing patch.");
  }
  text = text.replace(oldFinish, newFinish);
}

const oldAddZone = `    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDrawMode(false);
    setCornerMode(false);`;

const newAddZone = `    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDrawMode(true);
    setCornerMode(false);`;

if (text.includes(oldAddZone)) {
  text = text.replace(oldAddZone, newAddZone);
}

writeFileSync(appPath, text);
