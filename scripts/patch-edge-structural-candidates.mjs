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
  const boundaryPadX = Math.max(0.8, projectionZone.width * 0.018);
  const boundaryPadY = Math.max(0.8, projectionZone.height * 0.024);
  const topLimit = projectionZone.y + projectionZone.height * 0.18;
  const touchesProjectionBoundary = (box: ProjectionZone) =>
    box.x <= projectionZone.x + boundaryPadX ||
    box.y <= projectionZone.y + boundaryPadY ||
    box.x + box.width >= projectionZone.x + projectionZone.width - boundaryPadX ||
    box.y + box.height >= projectionZone.y + projectionZone.height - boundaryPadY;
  const isTopBlob = (box: ProjectionZone) => box.y <= topLimit && (box.width > projectionZone.width * 0.16 || box.height < projectionZone.height * 0.25);
  const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  const sideSupport = (box: ProjectionZone) => {
    const points = edgePoints.filter((point) => point.strength >= 70 && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
    if (points.length < 18) return 0;
    const bandX = Math.max(0.75, box.width * 0.16);
    const bandY = Math.max(0.75, box.height * 0.16);
    const leftYs = points.filter((point) => point.x <= box.x + bandX).map((point) => point.y);
    const rightYs = points.filter((point) => point.x >= box.x + box.width - bandX).map((point) => point.y);
    const topXs = points.filter((point) => point.y <= box.y + bandY).map((point) => point.x);
    const bottomXs = points.filter((point) => point.y >= box.y + box.height - bandY).map((point) => point.x);
    const left = leftYs.length >= 3 && span(leftYs) >= box.height * 0.34;
    const right = rightYs.length >= 3 && span(rightYs) >= box.height * 0.34;
    const top = topXs.length >= 3 && span(topXs) >= box.width * 0.34;
    const bottom = bottomXs.length >= 3 && span(bottomXs) >= box.width * 0.34;
    return [left, right, top, bottom].filter(Boolean).length;
  };
  const usable = (box: ProjectionZone) => {
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    if (touchesProjectionBoundary(box)) return false;
    if (isTopBlob(box)) return false;
    if (sideSupport(box) < 3) return false;
    if (box.width < Math.max(4.0, projectionZone.width * 0.055)) return false;
    if (box.height < Math.max(4.0, projectionZone.height * 0.075)) return false;
    if (area < projectionArea * 0.008 || area > projectionArea * 0.18) return false;
    if (aspect < 0.18 || aspect > 4.5) return false;
    return true;
  };

  const boxes: ProjectionZone[] = [];

  const cell = Math.max(0.45, Math.min(projectionZone.width, projectionZone.height) / 70);
  const grid = new Map<string, { x: number; y: number; count: number }>();
  for (const point of edgePoints) {
    if (point.strength < 76) continue;
    if (point.x < projectionZone.x + boundaryPadX || point.x > projectionZone.x + projectionZone.width - boundaryPadX) continue;
    if (point.y < projectionZone.y + boundaryPadY || point.y > projectionZone.y + projectionZone.height - boundaryPadY) continue;
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
    if (cells < 8 || count < 14) continue;
    if (density < 0.12) continue;
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
console.log("edge masks now require real perimeter side spans");
