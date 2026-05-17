import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const oldBlock = `  function finishPointerAction() {
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
  }`;

const newBlock = `  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) {
      setDrawMode(false);
      return;
    }
    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);
    if (rect.width < 2 || rect.height < 2) {
      setDrawMode(false);
      return;
    }
    const id = Date.now();
    setZones((current) => [
      ...current,
      { id, ...rect, included: true, label: \`manual \${draftZone.shape} avoid zone\` }
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDrawMode(false);
  }`;

if (!text.includes(newBlock)) {
  if (!text.includes(oldBlock)) throw new Error("Could not locate exact finishPointerAction block.");
  text = text.replace(oldBlock, newBlock);
}

const start = text.indexOf("  function finishPointerAction()");
const end = text.indexOf("\n\n  async function openProjectorMode", start);
if (start === -1 || end === -1) throw new Error("Could not verify finishPointerAction location.");
const finishBlock = text.slice(start, end);
if (!finishBlock.includes("setDrawMode(false);")) throw new Error("One-shot draw mode verification failed.");

writeFileSync(appPath, text);
