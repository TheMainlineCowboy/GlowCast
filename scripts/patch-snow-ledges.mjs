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
  const block = [
    'function createLedgesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {',
    '  const ledges: SnowLedge[] = [];',
    '',
    '  const addLedge = (x1Raw: number, y1: number, x2Raw: number, y2: number) => {',
    '    const dx = x2Raw - x1Raw;',
    '    const dy = y2 - y1;',
    '    if (Math.abs(dx) < 0.001) return;',
    '',
    '    const xMin = Math.min(x1Raw, x2Raw);',
    '    const xMax = Math.max(x1Raw, x2Raw);',
    '    const slope = dy / dx;',
    '    const intercept = y1 - slope * x1Raw;',
    '    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));',
    '',
    '    ledges.push({',
    '      x1: xMin,',
    '      y1,',
    '      x2: xMax,',
    '      y2,',
    '      slope,',
    '      intercept,',
    '      normalX: -dy / len,',
    '      normalY: dx / len,',
    '      accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)',
    '    });',
    '  };',
    '',
    '  zones.filter((zone) => zone.included).forEach((zone) => {',
    '    const shape = zone.shape ?? "rectangle";',
    '',
    '    if (shape === "rectangle") {',
    '      const x1Raw = (zone.x / 100) * canvasWidth;',
    '      const y = (zone.y / 100) * canvasHeight;',
    '      const x2Raw = ((zone.x + zone.width) / 100) * canvasWidth;',
    '      addLedge(x1Raw, y, x2Raw, y);',
    '      return;',
    '    }',
    '',
    '    if (shape === "circle" || shape === "oval") {',
    '      const x1Raw = (zone.x / 100) * canvasWidth;',
    '      const y = (zone.y / 100) * canvasHeight;',
    '      const x2Raw = ((zone.x + zone.width) / 100) * canvasWidth;',
    '      addLedge(x1Raw, y, x2Raw, y);',
    '      return;',
    '    }',
    '  });',
    '',
    '  return ledges;',
    '}',
    '',
    ''
  ].join('\n');

  source = source.slice(0, start) + block + source.slice(end);
}

source = source.replace(
  'ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";',
  'ctx.strokeStyle = "rgba(0, 255, 255, 0.95)";'
);
source = source.replace('ctx.lineWidth = 3;', 'ctx.lineWidth = 6;');

writeFileSync(path, source);