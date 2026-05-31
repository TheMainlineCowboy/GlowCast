import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

edge = edge.replace(
  /type AutoMaskOptions = \{ clusterRadius: number; minPoints: number; tolerance: number(?:; preferredShape\?: string)? \};/,
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

edge = edge.replace(
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  enabled: boolean;",
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  detectedShape?: \"freehand\" | \"rectangle\" | \"circle\" | \"oval\" | \"triangle\";\n  enabled: boolean;"
);

const generateStart = edge.indexOf("export function generateAutoMasks(");
const drawStart = edge.indexOf("export function drawProjectionWithMasks(", generateStart);
if (generateStart === -1 || drawStart === -1) {
  throw new Error("Flood fill mask patch failed: generateAutoMasks block not found.");
}

const block = `function maskBounds(points: Coordinate[]): ProjectionZone {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function hullCross(origin: Coordinate, a: Coordinate, b: Coordinate) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function maskConvexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [\`\${point.x.toFixed(3)},\${point.y.toFixed(3)}\`, point])).values()]
    .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  if (unique.length <= 3) return unique;
  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && hullCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && hullCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function simplifyHull(points: Coordinate[], maxPoints = 30) {
  if (points.length <= maxPoints) return points;
  const out: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) out.push(points[Math.floor(i * step)]);
  return out;
}

function expandPolygon(points: Coordinate[], projectionZone: ProjectionZone, amount: number): Coordinate[] {
  const bounds = maskBounds(points);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const d = Math.max(0.001, Math.hypot(dx, dy));
    const x = point.x + (dx / d) * amount;
    const y = point.y + (dy / d) * amount;
    return {
      x: Number(Math.max(projectionZone.x, Math.min(projectionZone.x + projectionZone.width, x)).toFixed(2)),
      y: Number(Math.max(projectionZone.y, Math.min(projectionZone.y + projectionZone.height, y)).toFixed(2))
    };
  });
}

function classifyMask(bounds: ProjectionZone, points: Coordinate[]): "freehand" | "rectangle" | "circle" | "oval" | "triangle" {
  const aspect = bounds.width / Math.max(0.01, bounds.height);
  if (points.length <= 4 && aspect > 0.55 && aspect < 1.6) return "rectangle";
  if (points.length <= 5 && aspect > 0.45 && aspect < 2.2) return "triangle";
  if (aspect > 0.82 && aspect < 1.18) return "circle";
  if (aspect >= 1.18 && aspect < 2.7) return "oval";
  return "freehand";
}

function edgeFloodFillMasks(edgePoints: EdgePoint[], projectionZone: ProjectionZone): AutoMaskZone[] {
  const inBounds = edgePoints.filter((point) => pointInsideBox(point, projectionZone));
  if (!inBounds.length) return [];

  const gridW = 360;
  const gridH = Math.max(90, Math.min(360, Math.round(gridW * (projectionZone.height / Math.max(1, projectionZone.width)))));
  const total = gridW * gridH;
  const barrier = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const index = (x: number, y: number) => y * gridW + x;
  const clampCell = (value: number, max: number) => Math.max(0, Math.min(max - 1, value));

  const strengths = inBounds.map((point) => point.strength).sort((a, b) => a - b);
  const floor = Math.max(44, strengths[Math.floor(strengths.length * 0.22)] ?? 44);
  const radius = 2;

  for (const point of inBounds) {
    if (point.strength < floor) continue;
    const gx = clampCell(Math.round(((point.x - projectionZone.x) / projectionZone.width) * (gridW - 1)), gridW);
    const gy = clampCell(Math.round(((point.y - projectionZone.y) / projectionZone.height) * (gridH - 1)), gridH);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.hypot(dx, dy) > radius + 0.35) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) continue;
        barrier[index(x, y)] = 1;
      }
    }
  }

  const queue: Array<[number, number]> = [];
  const pushOutside = (x: number, y: number) => {
    const i = index(x, y);
    if (barrier[i] || visited[i]) return;
    visited[i] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < gridW; x += 1) {
    pushOutside(x, 0);
    pushOutside(x, gridH - 1);
  }
  for (let y = 0; y < gridH; y += 1) {
    pushOutside(0, y);
    pushOutside(gridW - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop()!;
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const ni = index(nx, ny);
      if (barrier[ni] || visited[ni]) continue;
      visited[ni] = 1;
      queue.push([nx, ny]);
    }
  }

  const projectionArea = projectionZone.width * projectionZone.height;
  const components: Coordinate[][] = [];
  const seenInterior = new Uint8Array(total);

  for (let y = 1; y < gridH - 1; y += 1) {
    for (let x = 1; x < gridW - 1; x += 1) {
      const start = index(x, y);
      if (barrier[start] || visited[start] || seenInterior[start]) continue;
      const cells: Coordinate[] = [];
      const q: Array<[number, number]> = [[x, y]];
      seenInterior[start] = 1;
      while (q.length) {
        const [cx, cy] = q.pop()!;
        cells.push({
          x: projectionZone.x + (cx / (gridW - 1)) * projectionZone.width,
          y: projectionZone.y + (cy / (gridH - 1)) * projectionZone.height
        });
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
          const ni = index(nx, ny);
          if (barrier[ni] || visited[ni] || seenInterior[ni]) continue;
          seenInterior[ni] = 1;
          q.push([nx, ny]);
        }
      }
      components.push(cells);
    }
  }

  const raw = components
    .map((cells) => {
      const hull = simplifyHull(maskConvexHull(cells));
      if (hull.length < 3) return null;
      const expanded = expandPolygon(hull, projectionZone, Math.max(0.45, Math.min(projectionZone.width, projectionZone.height) * 0.012));
      const box = maskBounds(expanded);
      const area = box.width * box.height;
      const aspect = box.width / Math.max(0.01, box.height);
      if (box.width < Math.max(3.5, projectionZone.width * 0.035)) return null;
      if (box.height < Math.max(3.5, projectionZone.height * 0.045)) return null;
      if (area < Math.max(12, projectionArea * 0.002) || area > projectionArea * 0.22) return null;
      if (aspect < 0.12 || aspect > 7) return null;
      return { points: expanded, boundingBox: box, area, detectedShape: classifyMask(box, expanded) };
    })
    .filter((item): item is { points: Coordinate[]; boundingBox: ProjectionZone; area: number; detectedShape: "freehand" | "rectangle" | "circle" | "oval" | "triangle" } => Boolean(item))
    .sort((a, b) => b.area - a.area);

  const accepted: typeof raw = [];
  for (const item of raw) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.boundingBox, item.boundingBox);
      const minArea = Math.min(existing.boundingBox.width * existing.boundingBox.height, item.boundingBox.width * item.boundingBox.height);
      return overlap / Math.max(1, minArea) > 0.35;
    });
    if (!duplicate) accepted.push(item);
    if (accepted.length >= 12) break;
  }

  return accepted.map((item, i) => ({
    id: \`auto_mask_\${Date.now()}_\${i}\`,
    type: "auto-generated" as const,
    shape: "polygon" as const,
    points: item.points,
    boundingBox: {
      x: Number(item.boundingBox.x.toFixed(2)),
      y: Number(item.boundingBox.y.toFixed(2)),
      width: Number(item.boundingBox.width.toFixed(2)),
      height: Number(item.boundingBox.height.toFixed(2))
    },
    detectedShape: item.detectedShape,
    enabled: true
  }));
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  void _options;
  return edgeFloodFillMasks(edgePoints, projectionZone);
}

`;

edge = edge.slice(0, generateStart) + block + edge.slice(drawStart);
writeFileSync(edgePath, edge);

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

const oldMap = `        const shape = (mask.detectedShape ?? "rectangle") as MaskShape;
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
const newMap = `        const localPoints = mask.points.map((point) => ({
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
          label: "edge filled mask",
          shape: "freehand",
          points: localPoints
        });`;
if (app.includes(oldMap)) app = app.replace(oldMap, newMap);
else if (!app.includes('label: "edge filled mask"')) throw new Error("Flood fill app patch failed: auto mask mapping anchor not found.");

app = app.replace(
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate" && zone.label !== "edge outline"),',
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate" && zone.label !== "edge outline" && zone.label !== "edge filled mask"),'
);
app = app.replace(
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate"),',
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate" && zone.label !== "edge filled mask"),'
);
app = app.replace(
  '    setDetectMessage("Found " + usable.length + " edge-outline mask candidates from scanned edges.");',
  '    setDetectMessage("Filled " + usable.length + " closed edge outlines into polygon mask candidates.");'
);
app = app.replace(
  '    setDetectMessage("Converted " + usable.length + " scanned edge outlines into polygon mask candidates.");',
  '    setDetectMessage("Filled " + usable.length + " closed edge outlines into polygon mask candidates.");'
);

const oldSvgMask = `            {includedZones.map((zone) => (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
const newSvgMask = `            {includedZones.map((zone) => zone.points?.length ? (
              <polygon key={\`pm-\${zone.id}\`} points={zone.points.map((point) => \`${zone.x + (point.x * zone.width) / 100},${zone.y + (point.y * zone.height) / 100}\`).join(" ")} fill="black" />
            ) : (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
if (app.includes(oldSvgMask)) app = app.replace(oldSvgMask, newSvgMask);

writeFileSync(appPath, app);
console.log("edge scanner closed outlines are now flood-filled into actual polygon masks");
