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

  zones.filter((zone) => zone.included).forEach((zone) => {
    getTopLedgeSegments(zone, 36).forEach((segment) => {
      const x1Raw = (segment.x1 / 100) * canvasWidth;
      const y1 = (segment.y1 / 100) * canvasHeight;
      const x2Raw = (segment.x2 / 100) * canvasWidth;
      const y2 = (segment.y2 / 100) * canvasHeight;
      const dx = x2Raw - x1Raw;
      const dy = y2 - y1;

      if (Math.abs(dx) < 0.001) return;

      const xMin = Math.min(x1Raw, x2Raw);
      const xMax = Math.max(x1Raw, x2Raw);
      const slope = dy / dx;
      const intercept = y1 - slope * x1Raw;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));

      ledges.push({
        x1: xMin,
        y1,
        x2: xMax,
        y2,
        slope,
        intercept,
        normalX: -dy / len,
        normalY: dx / len,
        accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)
      });
    });
  });

  return ledges;
}

` +
    source.slice(end);
}

writeFileSync(path, source);
