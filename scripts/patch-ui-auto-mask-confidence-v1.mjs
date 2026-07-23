import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const marker = "Auto mask confidence:";
if (source.includes(marker)) {
  console.log("Automatic-mask confidence categories already present.");
  process.exit(0);
}

const helper = `function getAutoMaskConfidence(zone: ProjectZone | null, surface: Zone | null): "Strong" | "Review" | "Weak" | null {
  if (!zone || !(zone.label ?? "").startsWith("Auto architectural mask")) return null;

  const surfaceArea = Math.max((surface?.width ?? 100) * (surface?.height ?? 100), 1);
  const areaRatio = (zone.width * zone.height) / surfaceArea;
  const aspect = zone.width / Math.max(zone.height, 0.01);
  const vertices = zone.points?.length ?? 4;

  if (areaRatio < 0.008 || aspect < 0.16 || aspect > 6 || vertices > 14) return "Weak";
  if (areaRatio >= 0.02 && areaRatio <= 0.3 && aspect >= 0.25 && aspect <= 4.5 && vertices <= 10) return "Strong";
  return "Review";
}

`;

const appAnchor = /export default function App\s*\(/;
const appMatch = source.match(appAnchor);
if (!appMatch || appMatch.index === undefined) {
  throw new Error("Unable to locate App component for confidence helper insertion.");
}
source = source.slice(0, appMatch.index) + helper + source.slice(appMatch.index);

const statePattern = /(\s+const selectedEditable\s*=\s*selectedTarget\s*===\s*["']surface["']\s*\?\s*projectionArea\s*:\s*selectedZone\s*;)/;
if (!statePattern.test(source)) {
  throw new Error("Unable to locate selected mask state for confidence categories.");
}
source = source.replace(
  statePattern,
  `$1\n  const selectedAutoMaskConfidence = getAutoMaskConfidence(selectedZone, projectionArea);`
);

const headingPattern = /(\s*<strong>\s*\{selectedTarget\s*===\s*["']surface["']\s*\?\s*["']Projection Surface["']\s*:\s*`Zone \$\{zones\.findIndex\(\(zone\) => zone\.id === selectedZoneId\) \+ 1\}`\}\s*<\/strong>)/m;
if (!headingPattern.test(source)) {
  throw new Error("Unable to locate zone editor heading for confidence categories.");
}
source = source.replace(
  headingPattern,
  `$1\n              {selectedAutoMaskConfidence && (\n                <small className={\`autoMaskConfidence confidence\${selectedAutoMaskConfidence}\`}>\n                  Auto mask confidence: {selectedAutoMaskConfidence}\n                </small>\n              )}`
);

await fs.writeFile(path, source);
console.log("Added Strong, Review, and Weak confidence categories to selected automatic masks.");
