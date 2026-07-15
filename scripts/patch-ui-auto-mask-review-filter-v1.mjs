import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const stateAnchor = '  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);';
const stateLine = '  const [showOnlyAutoMasks, setShowOnlyAutoMasks] = useState(false);';

if (!source.includes(stateLine)) {
  if (!source.includes(stateAnchor)) throw new Error("Auto-mask filter state anchor not found.");
  source = source.replace(stateAnchor, `${stateAnchor}\n${stateLine}`);
}

const visibleAnchor = '  const includedZones = zones.filter((zone) => zone.included);';
const visibleLine = `  const visibleSetupZones = showOnlyAutoMasks ? zones.filter((zone) => ${autoMaskCheck}) : zones;`;
if (!source.includes(visibleLine)) {
  if (!source.includes(visibleAnchor)) throw new Error("Visible mask collection anchor not found.");
  source = source.replace(visibleAnchor, `${visibleAnchor}\n${visibleLine}`);
}

const stageAnchor = '{!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (';
const filteredStage = '{!projectionOnly && !cornerMode && !surfacePolygonMode && visibleSetupZones.map((zone) => (';
if (source.includes(stageAnchor)) {
  source = source.replace(stageAnchor, filteredStage);
  source = source.replace('<span>{index + 1}</span>', '<span>{zones.findIndex((item) => item.id === zone.id) + 1}</span>');
} else if (!source.includes(filteredStage)) {
  throw new Error("Setup mask rendering anchor not found.");
}

const buttonAnchor = `              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject} >`;
const filterButton = `              <button type="button" onClick={() => setShowOnlyAutoMasks((current) => !current)} disabled={!zones.some((zone) => ${autoMaskCheck})} className={showOnlyAutoMasks ? "activeEffect" : ""} aria-pressed={showOnlyAutoMasks} >\n                {showOnlyAutoMasks ? "Show All Masks" : "Review Auto Masks Only"}\n              </button>\n\n`;
if (!source.includes('Review Auto Masks Only')) {
  if (!source.includes(buttonAnchor)) throw new Error("Mask review button anchor not found.");
  source = source.replace(buttonAnchor, filterButton + buttonAnchor);
}

await fs.writeFile(path, source);
console.log("Added one-click auto-mask review filter.");
