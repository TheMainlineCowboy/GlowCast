import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const marker = "function pointsForBox(box: ProjectionZone): Coordinate[] {";
const fallback = `function fallbackClusterMasks(edgePoints: EdgePoint[], projectionZone: ProjectionZone): AutoMaskZone[] {
  const gridW = 180;
  const gridH = 180;
  const total = gridW * gridH;
  const grid = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const index = (x: number, y: number) => y * gridW + x;

  const minX = Math.max(1, Math.floor((projectionZone.x / 100) * gridW));
  const minY = Math.max(1, Math.floor((projectionZone.y / 100) * gridH));
  const maxX = Math.min(gridW - 2, Math.ceil(((projectionZone.x + projectionZone.width) / 100) * gridW));
  const maxY = Math.min(gridH - 2, Math.ceil(((projectionZone.y + projectionZone.height) / 100) * gridH));

  const points = edgePoints.filter((point) =>
    point.strength >= 82 &&
    point.x >= projectionZone.x && point.x <= projectionZone.x + projectionZone.width &&
    point.y >= projectionZone.y && point.y <= projectionZone.y + projectionZone.height
  );

  for (const point of points) {
    const gx = Math.round((point.x / 100) * (gridW - 1));
    const gy = Math.round((point.y / 100) * (gridH - 1));
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        grid[index(x, y)] = 1;
      }
    }
  }

  const directions = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];
  const boxes: ProjectionZone[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const start = index(x, y);
      if (!grid[start] || visited[start]) continue;
      const stack = [start];
      visited[start] = 1;
      let count = 0;
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;

      while (stack.length) {
        const current = stack.pop()!;
        count += 1;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);

        for (const d of directions) {
          const next = current + d;
          const nx = next % gridW;
          if (next < 0 || next >= total) continue;
          if ((d === 1 || d === -1) && Math.abs(nx - cx) !== 1) continue;
          if (!grid[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }

      const box = toPercentBox({ x0, y0, x1, y1 }, gridW, gridH);
      const area = box.width * box.height;
      const projectionArea = projectionZone.width * projectionZone.height;
      const density = count / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
      const aspect = box.width / Math.max(box.height, 0.01);

      if (count < 28) continue;
      if (area < projectionArea * 0.006 || area > projectionArea * 0.32) continue;
      if (box.width < Math.max(2.2, projectionZone.width * 0.035)) continue;
      if (box.height < Math.max(2.2, projectionZone.height * 0.05)) continue;
      if (density < 0.08) continue;
      if (aspect < 0.12 || aspect > 8.5) continue;

      boxes.push(expandBox(box, projectionZone));
    }
  }

  const accepted: ProjectionZone[] = [];
  for (const box of boxes.sort((a, b) => b.width * b.height - a.width * a.height)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, box);
      const minArea = Math.min(existing.width * existing.height, box.width * box.height);
      return overlap / Math.max(minArea, 0.01) > 0.38;
    });
    if (duplicate) continue;
    accepted.push(box);
    if (accepted.length >= 8) break;
  }

  return accepted
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((box, index) => ({
      id: "auto_mask_fallback_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points: pointsForBox(box),
      boundingBox: box,
      enabled: true
    }));
}

`;

const fallbackStart = source.indexOf("function fallbackClusterMasks(");
if (fallbackStart >= 0) {
  const fallbackEnd = source.indexOf("\nfunction pointsForBox(", fallbackStart);
  if (fallbackEnd < 0) throw new Error("Could not replace fallbackClusterMasks.");
  source = source.slice(0, fallbackStart) + fallback + source.slice(fallbackEnd + 1);
} else {
  source = source.replace(marker, fallback + marker);
}

const returnAnchor = `  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({`;

if (!source.includes("if (accepted.length === 0) return fallbackClusterMasks(edgePoints, projectionZone);")) {
  source = source.replace(returnAnchor, `  if (accepted.length === 0) return fallbackClusterMasks(edgePoints, projectionZone);

${returnAnchor}`);
}

writeFileSync(path, source);
console.log("fallback now groups connected visible edge components instead of tiny buckets");
