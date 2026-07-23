import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const marker = "Auto mask confidence:";
if (source.includes(marker)) {
  console.log("Automatic-mask confidence categories already present.");
  process.exit(0);
}

const helperAnchor = 'const shapeClass = (shape?: MaskShape) => `shape-${shape ?? "rectangle"}`;';
const helper = `${helperAnchor}\n\nfunction getAutoMaskConfidence(zone: ProjectZone | null, surface: Zone | null): "Strong" | "Review" | "Weak" | null {\n  if (!zone || !(zone.label ?? "").startsWith("Auto architectural mask")) return null;\n\n  const surfaceArea = Math.max((surface?.width ?? 100) * (surface?.height ?? 100), 1);\n  const areaRatio = (zone.width * zone.height) / surfaceArea;\n  const aspect = zone.width / Math.max(zone.height, 0.01);\n  const vertices = zone.points?.length ?? 4;\n\n  if (areaRatio < 0.008 || aspect < 0.16 || aspect > 6 || vertices > 14) return "Weak";\n  if (areaRatio >= 0.02 && areaRatio <= 0.3 && aspect >= 0.25 && aspect <= 4.5 && vertices <= 10) return "Strong";\n  return "Review";\n}`;

if (!source.includes(helperAnchor)) {
  throw new Error("Unable to locate shape helper anchor for confidence categories.");
}
source = source.replace(helperAnchor, helper);

const stateAnchor = "  const selectedEditable = selectedTarget === \"surface\" ? projectionArea : selectedZone;";
const stateReplacement = `${stateAnchor}\n  const selectedAutoMaskConfidence = getAutoMaskConfidence(selectedZone, projectionArea);`;
if (!source.includes(stateAnchor)) {
  throw new Error("Unable to locate selected mask state anchor for confidence categories.");
}
source = source.replace(stateAnchor, stateReplacement);

const editorAnchor = `              <strong>\n                {selectedTarget === "surface" ? "Projection Surface" : \`Zone \${zones.findIndex((zone) => zone.id === selectedZoneId) + 1}\`}\n              </strong>`;
const editorReplacement = `${editorAnchor}\n              {selectedAutoMaskConfidence && (\n                <small className={\`autoMaskConfidence confidence\${selectedAutoMaskConfidence}\`}>\n                  Auto mask confidence: {selectedAutoMaskConfidence}\n                </small>\n              )}`;
if (!source.includes(editorAnchor)) {
  throw new Error("Unable to locate zone editor heading anchor for confidence categories.");
}
source = source.replace(editorAnchor, editorReplacement);

await fs.writeFile(path, source);
console.log("Added Strong, Review, and Weak confidence categories to selected automatic masks.");
