import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("export function generateAutoMasks(");
const end = source.indexOf("\nexport function drawProjectionWithMasks(", start);
if (start < 0 || end < 0) throw new Error("Could not find generateAutoMasks block.");

const replacement = String.raw`export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const gridW = 220;
  const gridH = 220;
  const total = gridW * gridH;
  const idx = (x: number, y: number) => y * gridW + x;
  const toGridX = (x: number) => Math.max(0, Math.min(gridW - 1, Math.round((x / 100) * (gridW - 1))));
  const toGridY = (y: number) => Math.max(0, Math.min(gridH - 1, Math.round((y / 100) * (gridH - 1))));
  const toPercentPoint = (x: number, y: number): Coordinate => ({ x: (x / (gridW - 1)) * 100, y: (y / (gridH - 1)) * 100 });
  const keyFor = (x: number, y: number) => x + "," + y;
  const minX = toGridX(projectionZone.x + projectionZone.width * 0.025);
  const maxX = toGridX(projectionZone.x + projectionZone.width * 0.975);
  const minY = toGridY(projectionZone.y + projectionZone.height * 0.035);
  const maxY = toGridY(projectionZone.y + projectionZone.height * 0.965);
  const projectionArea = projectionZone.width * projectionZone.height;
  const edge = new Uint8Array(total);
  const pruned = new Uint8Array(total);

  for (const point of edgePoints) {
    if (point.strength < 58) continue;
    if (point.x < projectionZone.x || point.x > projectionZone.x + projectionZone.width) continue;
    if (point.y < projectionZone.y || point.y > projectionZone.y + projectionZone.height) continue;
    edge[idx(toGridX(point.x), toGridY(point.y))] = 1;
  }

  pruned.set(edge);

  const removeLongRuns = () => {
    const maxHorizontalRun = Math.max(28, Math.round((maxX - minX) * 0.42));
    const maxVerticalRun = Math.max(35, Math.round((maxY - minY) * 0.62));
    for (let y = minY; y <= maxY; y += 1) {
      let runStart = -1;
      for (let x = minX; x <= maxX + 1; x += 1) {
        const active = x <= maxX && edge[idx(x, y)];
        if (active && runStart < 0) runStart = x;
        if ((!active || x > maxX) && runStart >= 0) {
          const runEnd = x - 1;
          if (runEnd - runStart + 1 >= maxHorizontalRun) {
            for (let rx = runStart; rx <= runEnd; rx += 1) pruned[idx(rx, y)] = 0;
          }
          runStart = -1;
        }
      }
    }
    for (let x = minX; x <= maxX; x += 1) {
      let runStart = -1;
      for (let y = minY; y <= maxY + 1; y += 1) {
        const active = y <= maxY && edge[idx(x, y)];
        if (active && runStart < 0) runStart = y;
        if ((!active || y > maxY) && runStart >= 0) {
          const runEnd = y - 1;
          if (runEnd - runStart + 1 >= maxVerticalRun) {
            for (let ry = runStart; ry <= runEnd; ry += 1) pruned[idx(x, ry)] = 0;
          }
          runStart = -1;
        }
      }
    }
  };
  removeLongRuns();

  const grid = new Map<string, { x: number; y: number; points: Coordinate[] }>();
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pruned[idx(x, y)]) continue;
      const key = keyFor(x, y);
      grid.set(key, { x, y, points: [toPercentPoint(x, y)] });
    }
  }

  const cross = (o: Coordinate, a: Coordinate, b: Coordinate) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const convexHull = (points: Coordinate[]) => {
    const sorted = [...points]
      .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x)
      .filter((point, index, array) => index === 0 || point.x !== array[index - 1].x || point.y !== array[index - 1].y);
    if (sorted.length <= 3) return sorted;
    const lower: Coordinate[] = [];
    for (const point of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
    }
    const upper: Coordinate[] = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const point = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  };

  const expandHull = (points: Coordinate[], box: ProjectionZone) => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    return points.map((point) => ({
      x: clamp(cx + (point.x - cx) * 1.08, projectionZone.x, projectionZone.x + projectionZone.width),
      y: clamp(cy + (point.y - cy) * 1.08, projectionZone.y, projectionZone.y + projectionZone.height)
    }));
  };

  const visited = new Set<string>();
  const offsets = [-1, 0, 1];
  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];

  for (const [startKey, startCell] of grid) {
    if (visited.has(startKey)) continue;
    const queue = [startCell];
    visited.add(startKey);
    const clusterPoints: Coordinate[] = [];
    let cells = 0;
    while (queue.length) {
      const current = queue.pop()!;
      cells += 1;
      clusterPoints.push(...current.points);
      for (const dx of offsets) {
        for (const dy of offsets) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = keyFor(current.x + dx, current.y + dy);
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    if (clusterPoints.length < 10 || cells < 5) continue;
    const xs = clusterPoints.map((p) => p.x);
    const ys = clusterPoints.map((p) => p.y);
    const raw = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
    const box = expandBox(raw, projectionZone);
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    const centerY = box.y + box.height / 2;
    if (box.width < Math.max(3.0, projectionZone.width * 0.035)) continue;
    if (box.height < Math.max(3.0, projectionZone.height * 0.045)) continue;
    if (area < projectionArea * 0.0025 || area > projectionArea * 0.20) continue;
    if (aspect < 0.12 || aspect > 6.2) continue;
    if (centerY > projectionZone.y + projectionZone.height * 0.90) continue;
    const hull = convexHull(clusterPoints);
    if (hull.length < 3) continue;
    const density = clusterPoints.length / Math.max(area, 0.01);
    candidates.push({ box, points: expandHull(hull, box), score: clusterPoints.length + hull.length * 12 + density * 20 - area * 0.12 });
  }

  const accepted: { box: ProjectionZone; points: Coordinate[] }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.34;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 8) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({
      id: "auto_mask_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points,
      boundingBox: box,
      enabled: true
    }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now use line-pruned edge cluster hulls");
