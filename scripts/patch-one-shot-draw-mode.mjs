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

if (!text.includes("DRAW_MODE:")) {
  const stageMarker = "          {imageUrl && (\n            <img ref={imageRef} className=\"referencePhoto\" src={imageUrl} alt=\"Projection surface\" draggable={false} />\n          )}";
  const hud = "          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,.82)', color: drawMode ? '#ff3333' : '#33ff33', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', zIndex: 99999, border: '1px solid ' + (drawMode ? '#ff3333' : '#33ff33'), pointerEvents: 'none' }}>DRAW_MODE: {drawMode ? 'ON' : 'OFF'}</div>\n" + stageMarker;
  if (!text.includes(stageMarker)) throw new Error("Could not locate stage marker for DRAW_MODE HUD.");
  text = text.replace(stageMarker, hud);
}

if (!text.includes("DEBUG BUILD: DRAW MODE TEST")) {
  text = text.replace(
    "<h1>GlowCast MVP Prototype</h1>",
    "<h1>GlowCast MVP Prototype</h1>\n        <strong style={{ color: '#ff3333', fontFamily: 'monospace' }}>DEBUG BUILD: DRAW MODE TEST 20b4b46</strong>"
  );
}

if (!text.includes("DRAW_MODE:")) {
  throw new Error("DRAW_MODE HUD verification failed.");
}
if (!text.includes("DEBUG BUILD: DRAW MODE TEST")) {
  throw new Error("Debug build label verification failed.");
}

writeFileSync(appPath, text);
