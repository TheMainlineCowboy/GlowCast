import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const start = text.indexOf("  function finishPointerAction()");
const end = text.indexOf("\n\n  async function openProjectorMode", start);
if (start === -1 || end === -1) {
  throw new Error("Could not locate finishPointerAction for one-shot draw patch.");
}

let before = text.slice(0, start);
let finishBlock = text.slice(start, end);
let after = text.slice(end);

if (!finishBlock.includes("setSelectedZoneId(id);")) {
  throw new Error("Could not locate setSelectedZoneId(id) inside finishPointerAction.");
}

finishBlock = finishBlock.replace(
  "    if (!draftZone) return;",
  "    if (!draftZone) { setDrawMode(false); return; }"
);
finishBlock = finishBlock.replace(
  "    if (rect.width < 2 || rect.height < 2) return;",
  "    if (rect.width < 2 || rect.height < 2) { setDrawMode(false); return; }"
);

if (!finishBlock.includes("setSelectedZoneId(id);\n    setDrawMode(false);")) {
  finishBlock = finishBlock.replace(
    "    setSelectedZoneId(id);",
    "    setSelectedZoneId(id);\n    setDrawMode(false);"
  );
}

if (!finishBlock.includes("setDrawMode(false);")) {
  throw new Error("One-shot draw mode verification failed.");
}

text = before + finishBlock + after;
writeFileSync(appPath, text);
