import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

edge = edge.replace(
  /type AutoMaskOptions = \{ clusterRadius: number; minPoints: number; tolerance: number(?:; preferredShape\?: string)? \};/,
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

edge = edge.replace(
  /type DetectedMaskShape = "rectangle" \| "circle" \| "oval" \| "triangle";/,
  'type DetectedMaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";'
);

edge = edge.replace(
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  enabled: boolean;",
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  detectedShape?: DetectedMaskShape;\n  enabled: boolean;"
);

const generateStart = edge.indexOf("export function generateAutoMasks(");
const drawStart = edge.indexOf("export function drawProjectionWithMasks(", generateStart);
if (generateStart === -1 || drawStart === -1) {
  throw new Error("Edge polygon patch failed: generateAutoMasks block not found.");
}

const polygonHelpers = `function outlinePercentile(values: number[], percentile: number, fallback: number) {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * percentile)))];
}

function outlineConvexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [\`${point.x.toFixed(2)},\${point.y.toFixed(2)}\`, point])).values()]
    .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  if (unique.length <= 3) return unique;
  const cross = (origin: Coordinate, a: Coordinate, b: Coordinate) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function outlineDistanceToSegment(point: Coordinate, a: Coordinate, b: Coordinate) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function simplifyOutline(points: Coordinate[], tolerance = 0.55): Coordinate[] {
  if (points.length <= 8) return points;
  const closed = [...points, points[0]];
  const simplifyOpen = (input: Coordinate[]): Coordinate[] => {
    if (input.length <= 2) return input;
    let bestIndex = 0;
    let bestDistance = 0;
    const first = input[0];
    const last = input[input.length - 1];
    for (let i = 1; i < input.length - 1; i += 1) {
      const distance = outlineDistanceToSegment(input[i], first, last);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestDistance <= tolerance) return [first, last];
    const left = simplifyOpen(input.slice(0, bestIndex + 1));
    const right = simplifyOpen(input.slice(bestIndex));
    return [...left.slice(0, -1), ...right];
  };
  const simplified = simplifyOpen(closed).slice(0, -1);
  return simplified.length >= 3 ? simplified.slice(0, 28) : points.slice(0, 28);
}

function componentShapeFromOutline(box: ProjectionZone, points: Coordinate[]): DetectedMaskShape {
  const aspect = box.width / Math.max(box.height, 0.01);
  if (points.length <= 4 && aspect > 0.75 && aspect < 1.35) return "rectangle";
  if (points.length <= 4) return "triangle";
  if (aspect > 0.82 && aspect < 1.18) return "circle";
  if (aspect >= 1.18 && aspect < 2.3) return "oval";
  return "freehand";
}

function outlineMasksFromEdgeComponents(edgePoints: EdgePoint[], projectionZone: ProjectionZone, options: AutoMaskOptions): AutoMaskZone[] {
  const inBounds = edgePoints.filter((point) => pointInsideBox(point, projectionZone));
  if (!inBounds.length) return [];
  const strengthFloor = Math.max(58, outlinePercentile(inBounds.map((point) => point.strength), 0.38, 58));
  const points = inBounds.filter((point) => point.strength >= strengthFloor);
  if (!points.length) return [];

  const cellSize = Math.max(0.25, Math.min(projectionZone.width, projectionZone.height) / 155);
  const grid = new Map<string, { x: number; y: number; points: EdgePoint[] }>();
  for (const point of points) {
    const gx = Math.floor((point.x - projectionZone.x) / cellSize);
    const gy = Math.floor((point.y - projectionZone.y) / cellSize);
    const key = \`${gx},\${gy}\`;
    const current = grid.get(key);
    if (current) current.points.push(point);
    else grid.set(key, { x: gx, y: gy, points: [point] });
  }

  const visited = new Set<string>();
  const components: { points: EdgePoint[]; score: number }[] = [];
  const reach = 2;
  for (const [key, first] of grid) {
    if (visited.has(key)) continue;
    const queue = [first];
    visited.add(key);
    const component: EdgePoint[] = [];
    while (queue.length) {
      const cell = queue.pop()!;
      component.push(...cell.points);
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (let dy = -reach; dy <= reach; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = \`${cell.x + dx},\${cell.y + dy}\`;
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }
    const strength = component.reduce((sum, point) => sum + point.strength, 0) / Math.max(1, component.length);
    components.push({ points: component, score: component.length + strength / 12 });
  }

  const projectionArea = projectionZone.width * projectionZone.height;
  const rawMasks = components
    .map((component) => {
      const xs = component.points.map((point) => point.x);
      const ys = component.points.map((point) => point.y);
      const pad = Math.max(0.35, cellSize * 1.2);
      const box = clampToProjection({
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        width: Math.max(...xs) - Math.min(...xs) + pad * 2,
        height: Math.max(...ys) - Math.min(...ys) + pad * 2
      }, projectionZone);
      const area = box.width * box.height;
      if (box.width < 4 || box.height < 4) return null;
      if (area < projectionArea * 0.0025 || area > projectionArea * 0.20) return null;
      const outline = simplifyOutline(outlineConvexHull(component.points), Math.max(0.45, cellSize * 1.3));
      if (outline.length < 3) return null;
      const shape = componentShapeFromOutline(box, outline);
      return {
        id: \`auto_mask_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`,
        type: "auto-generated" as const,
        shape: "polygon" as const,
        points: outline.map((point) => ({ x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) })),
        boundingBox: {
          x: Number(box.x.toFixed(2)),
          y: Number(box.y.toFixed(2)),
          width: Number(box.width.toFixed(2)),
          height: Number(box.height.toFixed(2))
        },
        detectedShape: shape,
        enabled: true,
        score: component.score
      };
    })
    .filter((mask): mask is AutoMaskZone & { score: number } => Boolean(mask))
    .sort((a, b) => b.score - a.score);

  const accepted: (AutoMaskZone & { score: number })[] = [];
  for (const mask of rawMasks) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.boundingBox, mask.boundingBox);
      const minArea = Math.min(existing.boundingBox.width * existing.boundingBox.height, mask.boundingBox.width * mask.boundingBox.height);
      const aCenter = { x: existing.boundingBox.x + existing.boundingBox.width / 2, y: existing.boundingBox.y + existing.boundingBox.height / 2 };
      const bCenter = { x: mask.boundingBox.x + mask.boundingBox.width / 2, y: mask.boundingBox.y + mask.boundingBox.height / 2 };
      return overlap / Math.max(1, minArea) > 0.20 || Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y) < Math.max(3.8, Math.min(existing.boundingBox.width + mask.boundingBox.width, existing.boundingBox.height + mask.boundingBox.height) * 0.34);
    });
    if (duplicate) continue;
    accepted.push(mask);
    if (accepted.length >= 10) break;
  }

  return accepted.map(({ score, ...mask }) => mask);
}

`;

const generateBlock = `${polygonHelpers}export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  return outlineMasksFromEdgeComponents(edgePoints, projectionZone, _options);
}

`;

edge = edge.slice(0, generateStart) + generateBlock + edge.slice(drawStart);
writeFileSync(edgePath, edge);

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

const oldMap = `        return clampZone({
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
          label: "edge outline",
          shape: "freehand",
          points: localPoints
        });`;
if (app.includes(oldMap)) {
  app = app.replace(oldMap, newMap);
} else if (!app.includes('label: "edge outline"')) {
  throw new Error("Edge polygon app patch failed: auto mask zone mapping anchor not found.");
}

app = app.replace(
  '    setDetectMessage("Found " + usable.length + " edge-outline mask candidates from scanned edges.");',
  '    setDetectMessage("Converted " + usable.length + " scanned edge outlines into polygon mask candidates.");'
);

app = app.replace(
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate"),',
  '      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate" && zone.label !== "edge outline"),'
);

const oldSvgMask = `            {includedZones.map((zone) => (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
const newSvgMask = `            {includedZones.map((zone) => zone.points?.length ? (
              <polygon key={\`pm-\${zone.id}\`} points={zone.points.map((point) => \`${zone.x + (point.x * zone.width) / 100},${zone.y + (point.y * zone.height) / 100}\`).join(" ")} fill="black" />
            ) : (
              <rect key={\`pm-\${zone.id}\`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
            ))}`;
if (app.includes(oldSvgMask)) {
  app = app.replace(oldSvgMask, newSvgMask);
}

writeFileSync(appPath, app);
console.log("edge outlines convert directly into polygon masks");
