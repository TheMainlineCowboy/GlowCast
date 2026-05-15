import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

if (!source.includes("const normalizeShape = (shape?: MaskShape")) {
  source = source.replace(
    "const shapeClass = (shape?: MaskShape) => `shape-${shape ?? \"rectangle\"}`;",
    `const normalizeShape = (shape?: MaskShape, label?: string) => {
  const normalizedLabel = (label ?? "").toLowerCase();
  if (shape === "circle" || normalizedLabel.includes("circle")) return "circle";
  if (shape === "oval" || normalizedLabel.includes("oval")) return "oval";
  if (shape === "triangle" || normalizedLabel.includes("triangle")) return "triangle";
  if (shape === "freehand" || normalizedLabel.includes("freehand")) return "freehand";
  return shape ?? "rectangle";
};

const shapeClass = (shape?: MaskShape, label?: string) => \`shape-\${normalizeShape(shape, label)}\`;`
  );
}

source = source.replaceAll("shapeClass(zone.shape)", "shapeClass(zone.shape, zone.label)");
source = source.replaceAll("shapeClass(draftRect.shape)", "shapeClass(draftRect.shape, draftRect.label)");

source = source.replace(
  "const selectedEditable = selectedTarget === \"surface\" ? projectionArea : selectedZone;\n  const includedZones = zones.filter((zone) => zone.included);",
  `const selectedEditable = selectedTarget === "surface" ? projectionArea : selectedZone;
  const displayZones = zones.map((zone) => ({
    ...zone,
    shape: normalizeShape(zone.shape, zone.label)
  }));
  const includedZones = displayZones.filter((zone) => zone.included);`
);

source = source.replaceAll("zones.map((zone, index) => (", "displayZones.map((zone, index) => (");
source = source.replaceAll("zones.findIndex((zone) => zone.id === selectedZoneId)", "displayZones.findIndex((zone) => zone.id === selectedZoneId)");

source = source.replaceAll("zone.shape === \"triangle\"", "normalizeShape(zone.shape, zone.label) === \"triangle\"");
source = source.replaceAll("zone.shape === \"circle\" || zone.shape === \"oval\"", "normalizeShape(zone.shape, zone.label) === \"circle\" || normalizeShape(zone.shape, zone.label) === \"oval\"");
source = source.replaceAll("zone.shape === \"freehand\"", "normalizeShape(zone.shape, zone.label) === \"freehand\"");

source = source.replace(
  "const shape = zone.shape ?? \"rectangle\";",
  "const shape = normalizeShape(zone.shape, zone.label);"
);

source = source.replace(
  /\{includedZones\.map\(\(zone\) => \(\n\s*<rect key=\{`pm-\$\{zone\.id\}`} x=\{zone\.x\} y=\{zone\.y\} width=\{zone\.width\} height=\{zone\.height\} fill="black" \/>\n\s*\)\)\}/,
  "{includedZones.map((zone) => renderZoneMaskShape(zone, `pm-${zone.id}`))}"
);

writeFileSync(path, source);
