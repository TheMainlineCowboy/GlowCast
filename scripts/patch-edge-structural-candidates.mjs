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
  const inner = {
    x: projectionZone.x + projectionZone.width * 0.018,
    y: projectionZone.y + projectionZone.height * 0.025,
    width: projectionZone.width * 0.964,
    height: projectionZone.height * 0.945
  };
  const projectionArea = projectionZone.width * projectionZone.height;
  const clampPercent = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const paddedClampedBox = (box: ProjectionZone, padX: number, padY: number): ProjectionZone => {
    const x = Math.max(projectionZone.x, box.x - padX);
    const y = Math.max(projectionZone.y, box.y - padY);
    const maxX = Math.min(projectionZone.x + projectionZone.width, box.x + box.width + padX);
    const maxY = Math.min(projectionZone.y + projectionZone.height, box.y + box.height + padY);
    return { x, y, width: Math.max(0, maxX - x), height: Math.max(0, maxY - y) };
  };
  const visiblePoints = edgePoints.filter((point) =>
    point.x >= inner.x && point.x <= inner.x + inner.width &&
    point.y >= inner.y && point.y <= inner.y + inner.height
  );
  if (!visiblePoints.length) return [];

  const strengths = visiblePoints.map((point) => point.strength).sort((a, b) => a - b);
  const highPercentile = strengths[Math.floor(strengths.length * 0.68)] ?? 72;
  const mediumPercentile = strengths[Math.floor(strengths.length * 0.48)] ?? 62;
  const highCutoff = Math.max(72, Math.min(125, highPercentile));
  const mediumCutoff = Math.max(58, Math.min(92, mediumPercentile));

  const gridW = 240;
  const gridH = 240;
  const total = gridW * gridH;
  const idx = (x: number, y: number) => y * gridW + x;
  const toGridX = (x: number) => Math.max(0, Math.min(gridW - 1, Math.round((x / 100) * (gridW - 1))));
  const toGridY = (y: number) => Math.max(0, Math.min(gridH - 1, Math.round((y / 100) * (gridH - 1))));
  const toPercentPoint = (x: number, y: number): Coordinate => ({ x: (x / (gridW - 1)) * 100, y: (y / (gridH - 1)) * 100 });
  const minGX = toGridX(inner.x);
  const maxGX = toGridX(inner.x + inner.width);
  const minGY = toGridY(inner.y);
  const maxGY = toGridY(inner.y + inner.height);

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

  const buildPass = (cutoff: number, passName: "strong" | "medium") => {
    const layer = new Uint8Array(total);
    const connected = new Uint8Array(total);
    const passPoints = visiblePoints.filter((point) => point.strength >= cutoff);
    for (const point of passPoints) layer[idx(toGridX(point.x), toGridY(point.y))] = 1;

    const dilateRadius = passName === "strong" ? 2 : 3;
    const dilateLimit = passName === "strong" ? 5 : 9;
    for (let y = minGY; y <= maxGY; y += 1) {
      for (let x = minGX; x <= maxGX; x += 1) {
        if (!layer[idx(x, y)]) continue;
        for (let dy = -dilateRadius; dy <= dilateRadius; dy += 1) {
          for (let dx = -dilateRadius; dx <= dilateRadius; dx += 1) {
            if (dx * dx + dy * dy > dilateLimit) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
            connected[idx(nx, ny)] = 1;
          }
        }
      }
    }

    const pointNearVisibleEdge = (x: number, y: number) => {
      const radius = passName === "strong" ? 2 : 3;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          if (layer[idx(nx, ny)]) return true;
        }
      }
      return false;
    };

    const visited = new Uint8Array(total);
    const dirs = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];
    const passCandidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];

    for (let y = minGY; y <= maxGY; y += 1) {
      for (let x = minGX; x <= maxGX; x += 1) {
        const startIndex = idx(x, y);
        if (!connected[startIndex] || visited[startIndex]) continue;
        const queue = [startIndex];
        visited[startIndex] = 1;
        const component: number[] = [];
        let x0 = x, x1 = x, y0 = y, y1 = y;
        while (queue.length) {
          const current = queue.pop()!;
          const cx = current % gridW;
          const cy = Math.floor(current / gridW);
          component.push(current);
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
          y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const d of dirs) {
            const next = current + d;
            if (next < 0 || next >= total) continue;
            const nx = next % gridW;
            const ny = Math.floor(next / gridW);
            if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
            if (!connected[next] || visited[next]) continue;
            visited[next] = 1;
            queue.push(next);
          }
        }

        const trueEdgeCells = component.filter((cell) => pointNearVisibleEdge(cell % gridW, Math.floor(cell / gridW)));
        if (trueEdgeCells.length < (passName === "strong" ? 10 : 14)) continue;
        const raw = {
          x: (x0 / (gridW - 1)) * 100,
          y: (y0 / (gridH - 1)) * 100,
          width: ((x1 - x0) / (gridW - 1)) * 100,
          height: ((y1 - y0) / (gridH - 1)) * 100
        };
        const box = paddedClampedBox(raw, passName === "strong" ? 0.85 : 1.15, passName === "strong" ? 0.85 : 1.15);
        const area = box.width * box.height;
        const aspect = box.width / Math.max(box.height, 0.01);
        const centerY = box.y + box.height / 2;
        if (box.width < Math.max(passName === "strong" ? 3.8 : 4.6, projectionZone.width * (passName === "strong" ? 0.045 : 0.055))) continue;
        if (box.height < Math.max(passName === "strong" ? 3.8 : 5.0, projectionZone.height * (passName === "strong" ? 0.055 : 0.075))) continue;
        if (area < projectionArea * (passName === "strong" ? 0.003 : 0.005) || area > projectionArea * 0.22) continue;
        if (aspect < 0.14 || aspect > 6.5) continue;
        if (centerY > projectionZone.y + projectionZone.height * 0.91) continue;
        if (box.x <= projectionZone.x + projectionZone.width * 0.012 || box.x + box.width >= projectionZone.x + projectionZone.width * 0.988) continue;
        if (box.y <= projectionZone.y + projectionZone.height * 0.012 || box.y + box.height >= projectionZone.y + projectionZone.height * 0.988) continue;

        const hullSource = trueEdgeCells.map((cell) => toPercentPoint(cell % gridW, Math.floor(cell / gridW)));
        const hull = convexHull(hullSource);
        if (hull.length < 3) continue;
        const density = trueEdgeCells.length / Math.max(area, 0.01);
        passCandidates.push({
          box,
          points: hull.map((point) => ({
            x: clampPercent(box.x + (point.x - box.x) * 1.08, projectionZone.x, projectionZone.x + projectionZone.width),
            y: clampPercent(box.y + (point.y - box.y) * 1.08, projectionZone.y, projectionZone.y + projectionZone.height)
          })),
          score: trueEdgeCells.length + hull.length * 10 + density * 22 - area * 0.08 + (passName === "strong" ? 18 : 0)
        });
      }
    }
    return passCandidates;
  };

  const candidates = [...buildPass(highCutoff, "strong"), ...buildPass(mediumCutoff, "medium")];
  const accepted: { box: ProjectionZone; points: Coordinate[] }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.42;
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
console.log("auto masks now use strong and medium visible edge passes");
