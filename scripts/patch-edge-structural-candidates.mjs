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
  const projectionArea = projectionZone.width * projectionZone.height;
  const topLimit = projectionZone.y + projectionZone.height * 0.16;
  const isTopBlob = (box: ProjectionZone) => box.y <= topLimit && box.width > projectionZone.width * 0.22 && box.height < projectionZone.height * 0.24;
  const usable = (box: ProjectionZone) => {
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    if (isTopBlob(box)) return false;
    if (box.width < Math.max(2.5, projectionZone.width * 0.035)) return false;
    if (box.height < Math.max(2.5, projectionZone.height * 0.05)) return false;
    if (area < projectionArea * 0.004 || area > projectionArea * 0.28) return false;
    if (aspect < 0.10 || aspect > 6.5) return false;
    return true;
  };

  const boxes: ProjectionZone[] = [];
  for (const hole of findEnclosedHoles(edgePoints, projectionZone)) {
    const box = expandBox(toPercentBox(hole.box, 260, 260), projectionZone);
    if (usable(box)) boxes.push(box);
  }

  const cell = Math.max(0.45, Math.min(projectionZone.width, projectionZone.height) / 90);
  const grid = new Map<string, { x: number; y: number; count: number }>();
  for (const point of edgePoints) {
    if (point.strength < 90) continue;
    if (point.x < projectionZone.x || point.x > projectionZone.x + projectionZone.width) continue;
    if (point.y < projectionZone.y || point.y > projectionZone.y + projectionZone.height) continue;
    const gx = Math.floor((point.x - projectionZone.x) / cell);
    const gy = Math.floor((point.y - projectionZone.y) / cell);
    const key = gx + "," + gy;
    const current = grid.get(key);
    if (current) current.count += 1;
    else grid.set(key, { x: gx, y: gy, count: 1 });
  }

  const visited = new Set<string>();
  const offsets = [-1, 0, 1];
  for (const [key, first] of grid) {
    if (visited.has(key)) continue;
    const queue = [first];
    visited.add(key);
    let x0 = first.x, x1 = first.x, y0 = first.y, y1 = first.y, cells = 0, count = 0;
    while (queue.length) {
      const current = queue.pop()!;
      cells += 1;
      count += current.count;
      x0 = Math.min(x0, current.x); x1 = Math.max(x1, current.x);
      y0 = Math.min(y0, current.y); y1 = Math.max(y1, current.y);
      for (const dx of offsets) for (const dy of offsets) {
        if (dx === 0 && dy === 0) continue;
        const nextKey = (current.x + dx) + "," + (current.y + dy);
        if (visited.has(nextKey)) continue;
        const next = grid.get(nextKey);
        if (!next) continue;
        visited.add(nextKey);
        queue.push(next);
      }
    }
    const raw = {
      x: projectionZone.x + x0 * cell,
      y: projectionZone.y + y0 * cell,
      width: (x1 - x0 + 1) * cell,
      height: (y1 - y0 + 1) * cell
    };
    const box = expandBox(raw, projectionZone);
    const density = count / Math.max(1, box.width * box.height);
    if (cells < 10 || count < 18) continue;
    if (density < 0.35) continue;
    if (usable(box)) boxes.push(box);
  }

  const accepted: ProjectionZone[] = [];
  for (const box of boxes.sort((a, b) => (b.width * b.height) - (a.width * a.height))) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, box);
      const minArea = Math.min(existing.width * existing.height, box.width * box.height);
      return overlap / Math.max(minArea, 0.01) > 0.45;
    });
    if (duplicate) continue;
    accepted.push(box);
    if (accepted.length >= 12) break;
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
console.log("edge masks now combine closed holes with structural edge components");
