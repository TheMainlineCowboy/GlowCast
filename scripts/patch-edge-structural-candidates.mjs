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
  const gridW = 180;
  const gridH = 180;
  const total = gridW * gridH;
  const idx = (x: number, y: number) => y * gridW + x;
  const toGridX = (x: number) => Math.max(0, Math.min(gridW - 1, Math.round((x / 100) * (gridW - 1))));
  const toGridY = (y: number) => Math.max(0, Math.min(gridH - 1, Math.round((y / 100) * (gridH - 1))));
  const toPercentPoint = (x: number, y: number): Coordinate => ({ x: (x / (gridW - 1)) * 100, y: (y / (gridH - 1)) * 100 });

  const minX = toGridX(projectionZone.x);
  const maxX = toGridX(projectionZone.x + projectionZone.width);
  const minY = toGridY(projectionZone.y);
  const maxY = toGridY(projectionZone.y + projectionZone.height);
  const projectionArea = projectionZone.width * projectionZone.height;
  const edge = new Uint8Array(total);
  const closed = new Uint8Array(total);
  const outside = new Uint8Array(total);
  const seen = new Uint8Array(total);

  for (const point of edgePoints) {
    if (point.strength < 72) continue;
    if (point.x < projectionZone.x || point.x > projectionZone.x + projectionZone.width) continue;
    if (point.y < projectionZone.y || point.y > projectionZone.y + projectionZone.height) continue;
    edge[idx(toGridX(point.x), toGridY(point.y))] = 1;
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!edge[idx(x, y)]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx * dx + dy * dy > 6) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          closed[idx(nx, ny)] = 1;
        }
      }
    }
  }

  const queue: number[] = [];
  const pushOutside = (x: number, y: number) => {
    if (x < minX || x > maxX || y < minY || y > maxY) return;
    const i = idx(x, y);
    if (closed[i] || outside[i]) return;
    outside[i] = 1;
    queue.push(i);
  };
  for (let x = minX; x <= maxX; x += 1) { pushOutside(x, minY); pushOutside(x, maxY); }
  for (let y = minY; y <= maxY; y += 1) { pushOutside(minX, y); pushOutside(maxX, y); }
  const dirs = [1, -1, gridW, -gridW];
  while (queue.length) {
    const current = queue.shift()!;
    const cx = current % gridW;
    for (const d of dirs) {
      const next = current + d;
      if (next < 0 || next >= total) continue;
      if ((d === 1 || d === -1) && Math.abs((next % gridW) - cx) !== 1) continue;
      const nx = next % gridW;
      const ny = Math.floor(next / gridW);
      pushOutside(nx, ny);
    }
  }

  const makeBoundaryPolygon = (cells: number[], x0: number, y0: number, x1: number, y1: number): Coordinate[] => {
    const cellSet = new Set(cells);
    const boundary: Coordinate[] = [];
    for (const cell of cells) {
      const cx = cell % gridW;
      const cy = Math.floor(cell / gridW);
      if (!dirs.some((d) => !cellSet.has(cell + d))) continue;
      boundary.push(toPercentPoint(cx, cy));
    }
    if (boundary.length < 10) return pointsForBox(toPercentBox({ x0, y0, x1, y1 }, gridW, gridH));
    const center = boundary.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    center.x /= boundary.length;
    center.y /= boundary.length;
    const bins = new Map<number, Coordinate>();
    for (const point of boundary) {
      const angle = Math.atan2(point.y - center.y, point.x - center.x) + Math.PI;
      const bin = Math.floor((angle / (Math.PI * 2)) * 40);
      const previous = bins.get(bin);
      if (!previous || Math.hypot(point.x - center.x, point.y - center.y) > Math.hypot(previous.x - center.x, previous.y - center.y)) bins.set(bin, point);
    }
    const points = [...bins.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    return points.length >= 6 ? points : pointsForBox(toPercentBox({ x0, y0, x1, y1 }, gridW, gridH));
  };

  const boundaryEdgeContact = (cells: number[]) => {
    let contact = 0;
    let boundary = 0;
    const cellSet = new Set(cells);
    for (const cell of cells) {
      const cx = cell % gridW;
      const cy = Math.floor(cell / gridW);
      if (!dirs.some((d) => !cellSet.has(cell + d))) continue;
      boundary += 1;
      let nearEdge = false;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          if (edge[idx(nx, ny)]) nearEdge = true;
        }
      }
      if (nearEdge) contact += 1;
    }
    return boundary ? contact / boundary : 0;
  };

  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (let y = minY + 1; y < maxY; y += 1) {
    for (let x = minX + 1; x < maxX; x += 1) {
      const startIndex = idx(x, y);
      if (closed[startIndex] || outside[startIndex] || seen[startIndex]) continue;
      const stack = [startIndex];
      const cells: number[] = [];
      seen[startIndex] = 1;
      let x0 = x, x1 = x, y0 = y, y1 = y, count = 0;
      while (stack.length) {
        const current = stack.pop()!;
        cells.push(current);
        count += 1;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const d of dirs) {
          const next = current + d;
          if (next < 0 || next >= total) continue;
          if ((d === 1 || d === -1) && Math.abs((next % gridW) - cx) !== 1) continue;
          if (closed[next] || outside[next] || seen[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      const box = expandBox(toPercentBox({ x0, y0, x1, y1 }, gridW, gridH), projectionZone);
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      const centerY = box.y + box.height / 2;
      if (count < 18) continue;
      if (box.x <= projectionZone.x + projectionZone.width * 0.025) continue;
      if (box.y <= projectionZone.y + projectionZone.height * 0.035) continue;
      if (box.x + box.width >= projectionZone.x + projectionZone.width * 0.975) continue;
      if (box.y + box.height >= projectionZone.y + projectionZone.height * 0.965) continue;
      if (centerY > projectionZone.y + projectionZone.height * 0.86) continue;
      if (area < projectionArea * 0.004 || area > projectionArea * 0.18) continue;
      if (aspect < 0.12 || aspect > 6.0) continue;
      const contact = boundaryEdgeContact(cells);
      if (contact < 0.22) continue;
      const perimeter = edgePoints.filter((p) => p.strength >= 68 && p.x >= box.x - 1.2 && p.x <= box.x + box.width + 1.2 && p.y >= box.y - 1.2 && p.y <= box.y + box.height + 1.2).length;
      if (perimeter < 12) continue;
      candidates.push({ box, points: makeBoundaryPolygon(cells, x0, y0, x1, y1), score: perimeter + contact * 80 + count * 0.35 - area * 0.25 });
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[] }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.35;
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
console.log("edge masks now use boundary polygons and reject weak edge contact");
