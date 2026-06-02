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
  // Uses ONLY edgePoints: the same source used to render Edge-only View.
  // No original photo pixels, shadows, colors, or brightness are read here.
  const clampPercent = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const projectionArea = projectionZone.width * projectionZone.height;
  const inner = {
    x: projectionZone.x + projectionZone.width * 0.018,
    y: projectionZone.y + projectionZone.height * 0.025,
    width: projectionZone.width * 0.964,
    height: projectionZone.height * 0.945
  };

  const visiblePoints = edgePoints.filter((point) =>
    point.x >= inner.x && point.x <= inner.x + inner.width &&
    point.y >= inner.y && point.y <= inner.y + inner.height
  );
  if (visiblePoints.length < 10) return [];

  const gridW = 240;
  const gridH = 240;
  const total = gridW * gridH;
  const idx = (x: number, y: number) => y * gridW + x;
  const toGridX = (x: number) => Math.max(0, Math.min(gridW - 1, Math.round((x / 100) * (gridW - 1))));
  const toGridY = (y: number) => Math.max(0, Math.min(gridH - 1, Math.round((y / 100) * (gridH - 1))));
  const toPercentX = (x: number) => (x / (gridW - 1)) * 100;
  const toPercentY = (y: number) => (y / (gridH - 1)) * 100;
  const minGX = toGridX(inner.x);
  const maxGX = toGridX(inner.x + inner.width);
  const minGY = toGridY(inner.y);
  const maxGY = toGridY(inner.y + inner.height);

  const makeEdgeGrid = (cutoff: number, radius: number) => {
    const core = new Uint8Array(total);
    const grown = new Uint8Array(total);
    const strengthGrid = new Uint16Array(total);
    for (const point of visiblePoints) {
      if (point.strength < cutoff) continue;
      const gx = toGridX(point.x);
      const gy = toGridY(point.y);
      const cell = idx(gx, gy);
      core[cell] = 1;
      strengthGrid[cell] = Math.max(strengthGrid[cell], point.strength);
    }
    for (let y = minGY; y <= maxGY; y += 1) {
      for (let x = minGX; x <= maxGX; x += 1) {
        const cell = idx(x, y);
        if (!core[cell]) continue;
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (dx * dx + dy * dy > radius * radius + 1) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
            grown[idx(nx, ny)] = 1;
          }
        }
      }
    }
    return { core, grown, strengthGrid };
  };

  const perimeterSupport = (box: ProjectionZone, core: Uint8Array) => {
    const left = toGridX(box.x);
    const right = toGridX(box.x + box.width);
    const top = toGridY(box.y);
    const bottom = toGridY(box.y + box.height);
    let topHits = 0;
    let bottomHits = 0;
    let leftHits = 0;
    let rightHits = 0;
    for (let x = left; x <= right; x += 1) {
      for (let d = -3; d <= 3; d += 1) {
        if (top + d >= minGY && top + d <= maxGY && core[idx(x, top + d)]) topHits += 1;
        if (bottom + d >= minGY && bottom + d <= maxGY && core[idx(x, bottom + d)]) bottomHits += 1;
      }
    }
    for (let y = top; y <= bottom; y += 1) {
      for (let d = -3; d <= 3; d += 1) {
        if (left + d >= minGX && left + d <= maxGX && core[idx(left + d, y)]) leftHits += 1;
        if (right + d >= minGX && right + d <= maxGX && core[idx(right + d, y)]) rightHits += 1;
      }
    }
    const horizontalNeed = Math.max(3, Math.round((right - left + 1) * 0.10));
    const verticalNeed = Math.max(3, Math.round((bottom - top + 1) * 0.10));
    let sides = 0;
    if (topHits >= horizontalNeed) sides += 1;
    if (bottomHits >= horizontalNeed) sides += 1;
    if (leftHits >= verticalNeed) sides += 1;
    if (rightHits >= verticalNeed) sides += 1;
    return { sides, total: topHits + bottomHits + leftHits + rightHits };
  };

  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  const dirs = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];
  const passes = [
    { cutoff: 58, radius: 2, label: "visible" },
    { cutoff: 74, radius: 2, label: "medium" },
    { cutoff: 92, radius: 1, label: "strong" }
  ];

  for (const pass of passes) {
    const { core, grown, strengthGrid } = makeEdgeGrid(pass.cutoff, pass.radius);
    const visited = new Uint8Array(total);

    for (let y = minGY; y <= maxGY; y += 1) {
      for (let x = minGX; x <= maxGX; x += 1) {
        const startCell = idx(x, y);
        if (!grown[startCell] || visited[startCell]) continue;
        const queue = [startCell];
        visited[startCell] = 1;
        let x0 = x;
        let x1 = x;
        let y0 = y;
        let y1 = y;
        let grownCells = 0;
        let edgeCells = 0;
        let rawStrength = 0;

        while (queue.length) {
          const current = queue.pop()!;
          const cx = current % gridW;
          const cy = Math.floor(current / gridW);
          grownCells += 1;
          if (core[current]) {
            edgeCells += 1;
            rawStrength += strengthGrid[current];
          }
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
          y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const dir of dirs) {
            const next = current + dir;
            if (next < 0 || next >= total) continue;
            const nx = next % gridW;
            const ny = Math.floor(next / gridW);
            if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
            if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
            if (!grown[next] || visited[next]) continue;
            visited[next] = 1;
            queue.push(next);
          }
        }

        if (edgeCells < 8 || grownCells < 12) continue;
        const rawBox = {
          x: toPercentX(x0),
          y: toPercentY(y0),
          width: toPercentX(x1) - toPercentX(x0),
          height: toPercentY(y1) - toPercentY(y0)
        };
        const padX = Math.max(0.75, rawBox.width * 0.10);
        const padY = Math.max(0.75, rawBox.height * 0.10);
        const left = clampPercent(rawBox.x - padX, projectionZone.x, projectionZone.x + projectionZone.width);
        const top = clampPercent(rawBox.y - padY, projectionZone.y, projectionZone.y + projectionZone.height);
        const right = clampPercent(rawBox.x + rawBox.width + padX, projectionZone.x, projectionZone.x + projectionZone.width);
        const bottom = clampPercent(rawBox.y + rawBox.height + padY, projectionZone.y, projectionZone.y + projectionZone.height);
        const box = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
        const area = box.width * box.height;
        const aspect = box.width / Math.max(box.height, 0.01);
        const centerY = box.y + box.height / 2;
        const centerX = box.x + box.width / 2;

        if (box.width < Math.max(2.8, projectionZone.width * 0.035)) continue;
        if (box.height < Math.max(2.8, projectionZone.height * 0.045)) continue;
        if (area < projectionArea * 0.0018 || area > projectionArea * 0.30) continue;
        if (aspect < 0.12 || aspect > 8.5) continue;
        if (centerY > projectionZone.y + projectionZone.height * 0.96) continue;

        const nearProjectionEdge =
          box.x <= projectionZone.x + projectionZone.width * 0.012 ||
          box.x + box.width >= projectionZone.x + projectionZone.width * 0.988 ||
          box.y <= projectionZone.y + projectionZone.height * 0.012 ||
          box.y + box.height >= projectionZone.y + projectionZone.height * 0.988;
        const longHorizontalLine = box.width > projectionZone.width * 0.36 && box.height < projectionZone.height * 0.11;
        const longVerticalLine = box.height > projectionZone.height * 0.50 && box.width < projectionZone.width * 0.055;
        if (nearProjectionEdge && (longHorizontalLine || longVerticalLine)) continue;
        if (longHorizontalLine && edgeCells / Math.max(grownCells, 1) < 0.32) continue;

        const support = perimeterSupport(box, core);
        const density = edgeCells / Math.max(area, 0.01);
        const meanStrength = rawStrength / Math.max(edgeCells, 1);
        const objectLike =
          support.sides >= 1 ||
          edgeCells >= 20 ||
          (density >= 0.38 && box.width >= projectionZone.width * 0.055 && box.height >= projectionZone.height * 0.060);
        if (!objectLike) continue;

        candidates.push({
          box,
          points: [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x + box.width, y: box.y + box.height },
            { x: box.x, y: box.y + box.height }
          ],
          score:
            support.sides * 115 +
            support.total * 2.5 +
            edgeCells * 2.4 +
            density * 40 +
            meanStrength * 0.15 -
            area * 0.10 -
            (nearProjectionEdge ? 75 : 0) +
            (pass.label === "strong" ? 20 : pass.label === "medium" ? 10 : 0) +
            (centerX > projectionZone.x && centerX < projectionZone.x + projectionZone.width ? 5 : 0)
        });
      }
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.34;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 10) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({
      id: "auto_mask_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points,
      boundingBox: {
        x: Number(box.x.toFixed(2)),
        y: Number(box.y.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2))
      },
      enabled: true
    }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("auto masks verified: edge-points-only perimeter detector installed");
