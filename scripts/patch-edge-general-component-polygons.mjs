import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const startMarker = "export function generateAutoMasks(";
const endMarker = "\nexport function drawProjectionWithMasks";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error("Could not find generateAutoMasks block to replace.");
}

const replacement = `function componentHullCross(o: Coordinate, a: Coordinate, b: Coordinate) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function componentConvexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [point.x.toFixed(3) + "," + point.y.toFixed(3), point])).values()]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 3) return unique;

  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && componentHullCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }

  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && componentHullCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function componentBounds(points: Coordinate[]): ProjectionZone {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function expandComponentPolygon(points: Coordinate[], amount: number, projectionZone: ProjectionZone): Coordinate[] {
  const bounds = componentBounds(points);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    return {
      x: Number(Math.max(projectionZone.x, Math.min(projectionZone.x + projectionZone.width, point.x + (dx / distance) * amount)).toFixed(2)),
      y: Number(Math.max(projectionZone.y, Math.min(projectionZone.y + projectionZone.height, point.y + (dy / distance) * amount)).toFixed(2))
    };
  });
}

function simplifyComponentPolygon(points: Coordinate[], maxPoints = 32): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const simplified: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) simplified.push(points[Math.floor(i * step)]);
  return simplified;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  if (!edgePoints.length || projectionArea <= 0) return [];

  const marginX = Math.max(0.45, projectionZone.width * 0.008);
  const marginY = Math.max(0.45, projectionZone.height * 0.01);
  const usable = {
    x: projectionZone.x + marginX,
    y: projectionZone.y + marginY,
    width: Math.max(1, projectionZone.width - marginX * 2),
    height: Math.max(1, projectionZone.height - marginY * 2)
  };

  // General rule: use the scanned edge components themselves. Do not guess templates
  // like circle/oval/triangle, and do not tune for one photo. Any connected cluster of
  // strong edge pixels inside the projection surface can become a custom polygon mask.
  const strong = edgePoints.filter((point) => pointInsideBox(point, usable) && point.strength >= 72);
  if (!strong.length) return [];

  const cellSize = Math.max(0.22, Math.min(projectionZone.width, projectionZone.height) / 130);
  const grid = new Map<string, { gx: number; gy: number; points: EdgePoint[]; strength: number }>();
  for (const point of strong) {
    const gx = Math.floor((point.x - projectionZone.x) / cellSize);
    const gy = Math.floor((point.y - projectionZone.y) / cellSize);
    const key = gx + "," + gy;
    const cell = grid.get(key);
    if (cell) {
      cell.points.push(point);
      cell.strength += point.strength;
    } else {
      grid.set(key, { gx, gy, points: [point], strength: point.strength });
    }
  }

  const visited = new Set<string>();
  const rawComponents: Array<{ points: Coordinate[]; box: ProjectionZone; edgeCount: number; score: number }> = [];
  const neighborReach = 2;

  for (const [key, first] of grid) {
    if (visited.has(key)) continue;
    const queue = [first];
    visited.add(key);
    const componentPoints: Coordinate[] = [];
    let strength = 0;
    let cellCount = 0;

    while (queue.length) {
      const cell = queue.pop()!;
      cellCount += 1;
      strength += cell.strength;
      for (const point of cell.points) componentPoints.push({ x: point.x, y: point.y });

      for (let dx = -neighborReach; dx <= neighborReach; dx += 1) {
        for (let dy = -neighborReach; dy <= neighborReach; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = (cell.gx + dx) + "," + (cell.gy + dy);
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    const box = componentBounds(componentPoints);
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    const edgeCount = componentPoints.length;

    if (cellCount < 5 || edgeCount < 12) continue;
    if (box.width < Math.max(3.5, projectionZone.width * 0.038)) continue;
    if (box.height < Math.max(3.0, projectionZone.height * 0.045)) continue;
    if (area < Math.max(9, projectionArea * 0.0018)) continue;
    if (area > projectionArea * 0.22) continue;
    if (aspect < 0.16 || aspect > 6.5) continue;

    rawComponents.push({
      points: componentPoints,
      box,
      edgeCount,
      score: edgeCount + strength / 70 + area * 1.6
    });
  }

  // Merge pieces that are clearly parts of the same physical object, such as a window
  // frame plus screen bars, without merging separate nearby windows/doors across the wall.
  let components = [...rawComponents].sort((a, b) => b.score - a.score);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < components.length; i += 1) {
      for (let j = i + 1; j < components.length; j += 1) {
        const a = components[i];
        const b = components[j];
        const overlap = overlapAmount(a.box, b.box);
        const minArea = Math.min(a.box.width * a.box.height, b.box.width * b.box.height);
        const gap = boxGap(a.box, b.box);
        const nearX = gap.x <= Math.max(1.8, Math.min(a.box.width, b.box.width) * 0.36, projectionZone.width * 0.026);
        const nearY = gap.y <= Math.max(1.8, Math.min(a.box.height, b.box.height) * 0.36, projectionZone.height * 0.038);
        const stronglyRelated = overlap / Math.max(minArea, 1) > 0.16 || (nearX && nearY);
        if (!stronglyRelated) continue;

        const mergedPoints = a.points.concat(b.points);
        const mergedBox = componentBounds(mergedPoints);
        const mergedArea = mergedBox.width * mergedBox.height;
        const mergedAspect = mergedBox.width / Math.max(mergedBox.height, 0.01);
        if (mergedArea > projectionArea * 0.24) continue;
        if (mergedAspect < 0.16 || mergedAspect > 6.5) continue;

        components[i] = {
          points: mergedPoints,
          box: mergedBox,
          edgeCount: a.edgeCount + b.edgeCount,
          score: a.score + b.score + 25
        };
        components.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  const accepted: Array<{ points: Coordinate[]; box: ProjectionZone; score: number }> = [];
  for (const component of components.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, component.box);
      const minArea = Math.min(existing.box.width * existing.box.height, component.box.width * component.box.height);
      return overlap / Math.max(minArea, 1) > 0.36;
    });
    if (duplicate) continue;

    const hull = simplifyComponentPolygon(componentConvexHull(component.points));
    if (hull.length < 3) continue;
    const expanded = expandComponentPolygon(hull, Math.max(0.35, Math.min(component.box.width, component.box.height) * 0.06), projectionZone);
    const box = componentBounds(expanded);
    accepted.push({ points: expanded, box, score: component.score });
    if (accepted.length >= 10) break;
  }

  return accepted.map((candidate, index) => ({
    id: "auto_mask_" + String(Date.now()) + "_" + String(index),
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points,
    boundingBox: {
      x: Number(candidate.box.x.toFixed(2)),
      y: Number(candidate.box.y.toFixed(2)),
      width: Number(candidate.box.width.toFixed(2)),
      height: Number(candidate.box.height.toFixed(2))
    },
    enabled: true
  }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge mask candidates now use general connected edge components as custom polygon masks");
