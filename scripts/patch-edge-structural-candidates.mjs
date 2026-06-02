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
  const cell = Math.max(0.55, Math.min(projectionZone.width, projectionZone.height) / 78);
  const projectionArea = projectionZone.width * projectionZone.height;
  const grid = new Map<string, { x: number; y: number; points: EdgePoint[] }>();
  const keyFor = (x: number, y: number) => x + "," + y;

  for (const point of edgePoints) {
    if (point.strength < 70) continue;
    if (point.x <= projectionZone.x + projectionZone.width * 0.025) continue;
    if (point.y <= projectionZone.y + projectionZone.height * 0.035) continue;
    if (point.x >= projectionZone.x + projectionZone.width * 0.975) continue;
    if (point.y >= projectionZone.y + projectionZone.height * 0.965) continue;
    const gx = Math.floor((point.x - projectionZone.x) / cell);
    const gy = Math.floor((point.y - projectionZone.y) / cell);
    const key = keyFor(gx, gy);
    const existing = grid.get(key);
    if (existing) existing.points.push(point);
    else grid.set(key, { x: gx, y: gy, points: [point] });
  }

  const visited = new Set<string>();
  const offsets = [-2, -1, 0, 1, 2];
  const candidates: { box: ProjectionZone; score: number }[] = [];

  const sideSupport = (box: ProjectionZone, points: EdgePoint[]) => {
    const bandX = Math.max(0.8, box.width * 0.16);
    const bandY = Math.max(0.8, box.height * 0.16);
    const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
    const left = points.filter((p) => p.x <= box.x + bandX).map((p) => p.y);
    const right = points.filter((p) => p.x >= box.x + box.width - bandX).map((p) => p.y);
    const top = points.filter((p) => p.y <= box.y + bandY).map((p) => p.x);
    const bottom = points.filter((p) => p.y >= box.y + box.height - bandY).map((p) => p.x);
    return [
      left.length >= 4 && span(left) >= box.height * 0.32,
      right.length >= 4 && span(right) >= box.height * 0.32,
      top.length >= 4 && span(top) >= box.width * 0.32,
      bottom.length >= 4 && span(bottom) >= box.width * 0.32
    ].filter(Boolean).length;
  };

  for (const [startKey, startCell] of grid) {
    if (visited.has(startKey)) continue;
    const queue = [startCell];
    visited.add(startKey);
    const clusterPoints: EdgePoint[] = [];
    let cells = 0;
    while (queue.length) {
      const current = queue.pop()!;
      cells += 1;
      clusterPoints.push(...current.points);
      for (const dx of offsets) {
        for (const dy of offsets) {
          if (dx === 0 && dy === 0) continue;
          if (Math.abs(dx) + Math.abs(dy) > 3) continue;
          const nextKey = keyFor(current.x + dx, current.y + dy);
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    if (clusterPoints.length < 22 || cells < 6) continue;
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
    if (box.width < Math.max(5.0, projectionZone.width * 0.07)) continue;
    if (box.height < Math.max(5.0, projectionZone.height * 0.09)) continue;
    if (area < projectionArea * 0.008 || area > projectionArea * 0.22) continue;
    if (aspect < 0.18 || aspect > 5.4) continue;
    if (centerY > projectionZone.y + projectionZone.height * 0.88) continue;
    const support = sideSupport(box, clusterPoints);
    if (support < 2) continue;
    const density = clusterPoints.length / Math.max(area, 0.01);
    candidates.push({ box, score: clusterPoints.length + support * 85 + density * 12 - area * 0.18 });
  }

  const accepted: ProjectionZone[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate.box);
      const minArea = Math.min(existing.width * existing.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.32;
    });
    if (duplicate) continue;
    accepted.push(candidate.box);
    if (accepted.length >= 6) break;
  }

  return accepted
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((box, index) => ({
      id: "auto_mask_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points: pointsForBox(box),
      boundingBox: box,
      enabled: true
    }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now use edge cluster hulls instead of interior flood-fill regions");
