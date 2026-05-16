import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

source = source.replace(
  'import { zoneToGeometryPoints } from "./shapeGeometry";',
  'import { zoneToGeometryPoints, getTopLedgeSegments } from "./shapeGeometry";'
);

const start = source.indexOf("function createLedgesFromZones(");
const end = source.indexOf("function CanvasSnowLayer(", start);

if (start !== -1 && end !== -1) {
  source =
    source.slice(0, start) +
    `function createLedgesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {
  const ledges: SnowLedge[] = [];

  zones.filter((zone) => zone.included && (zone.shape ?? "rectangle") === "rectangle").forEach((zone) => {
    const x1Raw = (zone.x / 100) * canvasWidth;
    const y = (zone.y / 100) * canvasHeight;
    const x2Raw = ((zone.x + zone.width) / 100) * canvasWidth;
    const dx = x2Raw - x1Raw;

    if (Math.abs(dx) < 0.001) return;

    const xMin = Math.min(x1Raw, x2Raw);
    const xMax = Math.max(x1Raw, x2Raw);
    const slope = 0;
    const intercept = y;

    ledges.push({
      x1: xMin,
      y1: y,
      x2: xMax,
      y2: y,
      slope,
      intercept,
      normalX: 0,
      normalY: 1,
      accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)
    });
  });

  return ledges;
}

` +
    source.slice(end);
}

writeFileSync(path, source);
