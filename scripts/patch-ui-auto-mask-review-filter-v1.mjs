import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const autoMaskCheck = '(zone.label ?? "").startsWith("Auto architectural mask")';
const stateAnchor = '  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);';
const stateLine = '  const [showOnlyAutoMasks, setShowOnlyAutoMasks] = useState(false);';
if (!source.includes(stateLine)) source = source.replace(stateAnchor, `${stateAnchor}\n${stateLine}`);

const visibleAnchor = '  const includedZones = zones.filter((zone) => zone.included);';
const visibleLine = `  const visibleSetupZones = showOnlyAutoMasks ? zones.filter((zone) => ${autoMaskCheck}) : zones;`;
if (!source.includes(visibleLine)) source = source.replace(visibleAnchor, `${visibleAnchor}\n${visibleLine}`);

const stageAnchor = '{!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (';
const filteredStage = '{!projectionOnly && !cornerMode && !surfacePolygonMode && visibleSetupZones.map((zone, index) => (';
if (!source.includes(filteredStage)) source = source.replace(stageAnchor, filteredStage);

const filterButton = `              <button type="button" onClick={() => setShowOnlyAutoMasks((current) => !current)} disabled={!zones.some((zone) => ${autoMaskCheck})} className={showOnlyAutoMasks ? "activeEffect" : ""} aria-pressed={showOnlyAutoMasks} >\n                {showOnlyAutoMasks ? "Show All Masks" : "Review Auto Masks Only"}\n              </button>\n`;
const toolbarAnchor = '              <button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl} >';
if (!source.includes('Review Auto Masks Only')) source = source.replace(toolbarAnchor, filterButton + toolbarAnchor);

const required = [stateLine, visibleLine, filteredStage, 'Review Auto Masks Only'];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Auto-mask review filter anchor missing after patch: ${marker}`);
}

await fs.writeFile(path, source);
console.log("Added one-click auto-mask review filter.");
