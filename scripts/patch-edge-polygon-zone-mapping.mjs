import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

const oldBlock = `        const shape = (mask.detectedShape ?? "rectangle") as MaskShape;
        return clampZone({
          id: Date.now() + index,
          x: mask.boundingBox.x,
          y: mask.boundingBox.y,
          width: mask.boundingBox.width,
          height: mask.boundingBox.height,
          included: false,
          label: "edge candidate",
          shape
        });`;

const newBlock = `        const localPoints = mask.points.map((point) => ({
          x: Number((((point.x - mask.boundingBox.x) / Math.max(mask.boundingBox.width, 0.01)) * 100).toFixed(2)),
          y: Number((((point.y - mask.boundingBox.y) / Math.max(mask.boundingBox.height, 0.01)) * 100).toFixed(2))
        }));
        return clampZone({
          id: Date.now() + index,
          x: mask.boundingBox.x,
          y: mask.boundingBox.y,
          width: mask.boundingBox.width,
          height: mask.boundingBox.height,
          included: false,
          label: "edge candidate",
          shape: "freehand" as MaskShape,
          points: localPoints
        });`;

if (app.includes(oldBlock)) {
  app = app.replace(oldBlock, newBlock);
} else if (app.includes('label: "edge filled mask"')) {
  app = app.replaceAll('label: "edge filled mask"', 'label: "edge candidate"');
} else if (!app.includes('label: "edge candidate"')) {
  throw new Error("Could not find edge candidate mapping block to convert polygon masks.");
}

app = app.replaceAll('label: "edge filled mask"', 'label: "edge candidate"');
app = app.replaceAll('selectedZone.label !== "edge candidate"', 'selectedZone.label !== "edge candidate"');
app = app.replaceAll('zone.label !== "edge mask" && zone.label !== "edge candidate" && zone.label !== "edge filled mask"', 'zone.label !== "edge mask" && zone.label !== "edge candidate"');
app = app.replaceAll('zone.label !== "edge mask" && zone.label !== "edge candidate"', 'zone.label !== "edge mask" && zone.label !== "edge candidate"');
app = app.replaceAll('Found " + usable.length + " edge-outline mask candidates from scanned edges.', 'Filled " + usable.length + " closed edge outlines into polygon mask candidates.');
app = app.replaceAll('No usable edge mask candidates found inside the selected projection surface. Try tightening the projection outline around the object.', 'No closed edge outlines found inside the projection surface. Use Edge-only view to check whether the object outline is fully connected.');

const oldSvgMask = `            {includedZones.map((zone) => (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
const newSvgMask = `            {includedZones.map((zone) => zone.points?.length ? (
              <polygon key={\`pm-\${zone.id}\`} points={zone.points.map((point) => String(zone.x + (point.x * zone.width) / 100) + "," + String(zone.y + (point.y * zone.height) / 100)).join(" ")} fill="black" />
            ) : (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
if (app.includes(oldSvgMask)) app = app.replace(oldSvgMask, newSvgMask);

writeFileSync(path, app);
console.log("edge candidates preserve scanned polygon outlines and remain selectable candidates");