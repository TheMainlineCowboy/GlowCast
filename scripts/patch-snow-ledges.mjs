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
    '      const geometry = zoneToGeometryPoints(zone, 144).map((point) => ({',
    '        x: (point.x / 100) * canvasWidth,',
    '        y: (point.y / 100) * canvasHeight',
    '      }));',
    '      if (geometry.length < 2) return;',
    '      const minY = Math.min(...geometry.map((point) => point.y));',
    '      const maxY = Math.max(...geometry.map((point) => point.y));',
    '      const topBand = minY + (maxY - minY) * 0.74;',
    '',
    '      for (let index = 0; index < geometry.length; index += 1) {',
    '        const p1 = geometry[index];',
    '        const p2 = geometry[(index + 1) % geometry.length];',
    '        if (p1.y > topBand || p2.y > topBand) continue;',
    '        if (Math.abs(p2.x - p1.x) < 0.001) continue;',
    '        addLedge(p1.x, p1.y, p2.x, p2.y);',
    '      }',
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

writeFileSync(path, source);