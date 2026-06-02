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
  if (visiblePoints.length < 12) return [];

  const strengths = visiblePoints.map((point) => point.strength).sort((a, b) => a - b);
  const strongCutoff = Math.max(66, Math.min(112, strengths[Math.floor(strengths.length * 0.54)] ?? 72));
  const sourcePoints = visiblePoints.filter((point) => point.strength >= strongCutoff);
  if (sourcePoints.length < 12) return [];

  const gridW = 260;
  const gridH = 260;
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

  const edge = new Uint8Array(total);
  const strengthGrid = new Uint16Array(total);
  for (const point of sourcePoints) {
    const gx = toGridX(point.x);
    const gy = toGridY(point.y);
    const cell = idx(gx, gy);
    edge[cell] = 1;
    strengthGrid[cell] = Math.max(strengthGrid[cell], point.strength);
  }

  // Lightly connect the visible Edge-only pixels. This keeps broken window/door edges
  // together but avoids turning long siding/roof lines into filled blobs.
  const connected = new Uint8Array(total);
  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      const cell = idx(x, y);
      if (!edge[cell]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx * dx + dy * dy > 5) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          connected[idx(nx, ny)] = 1;
        }
      }
    }
  }

  const visited = new Uint8Array(total);
  const dirs = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];
  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];

  const countSupport = (box: ProjectionZone) => {
    const left = toGridX(box.x);
    const right = toGridX(box.x + box.width);
    const top = toGridY(box.y);
    const bottom = toGridY(box.y + box.height);
    let topHits = 0;
    let bottomHits = 0;
    let leftHits = 0;
    let rightHits = 0;
    let diagonalHits = 0;
    for (let x = left; x <= right; x += 1) {
      for (let d = -3; d <= 3; d += 1) {
        if (top + d >= minGY && top + d <= maxGY && edge[idx(x, top + d)]) topHits += 1;
        if (bottom + d >= minGY && bottom + d <= maxGY && edge[idx(x, bottom + d)]) bottomHits += 1;
      }
    }
    for (let y = top; y <= bottom; y += 1) {
      for (let d = -3; d <= 3; d += 1) {
        if (left + d >= minGX && left + d <= maxGX && edge[idx(left + d, y)]) leftHits += 1;
        if (right + d >= minGX && right + d <= maxGX && edge[idx(right + d, y)]) rightHits += 1;
      }
    }
    const w = Math.max(1, right - left + 1);
    const h = Math.max(1, bottom - top + 1);
    const diagonalSamples = Math.max(w, h);
    for (let i = 0; i <= diagonalSamples; i += 1) {
      const t = i / Math.max(1, diagonalSamples);
      const ax = Math.round(left + (right - left) * t);
      const ay = Math.round(top + (bottom - top) * t);
      const bx = Math.round(right - (right - left) * t);
      const by = ay;
      for (let d = -2; d <= 2; d += 1) {
        if (ax >= minGX && ax <= maxGX && ay + d >= minGY && ay + d <= maxGY && edge[idx(ax, ay + d)]) diagonalHits += 1;
        if (bx >= minGX && bx <= maxGX && by + d >= minGY && by + d <= maxGY && edge[idx(bx, by + d)]) diagonalHits += 1;
      }
    }
    const horizontalNeed = Math.max(4, Math.round(w * 0.16));
    const verticalNeed = Math.max(4, Math.round(h * 0.16));
    let sides = 0;
    if (topHits >= horizontalNeed) sides += 1;
    if (bottomHits >= horizontalNeed) sides += 1;
    if (leftHits >= verticalNeed) sides += 1;
    if (rightHits >= verticalNeed) sides += 1;
    return { sides, topHits, bottomHits, leftHits, rightHits, diagonalHits };
  };

  const makeBoxCandidate = (x0: number, y0: number, x1: number, y1: number, edgeCells: number, rawStrength: number) => {
    const rawBox = {
      x: toPercentX(x0),
      y: toPercentY(y0),
      width: toPercentX(x1) - toPercentX(x0),
      height: toPercentY(y1) - toPercentY(y0)
    };
    const padX = Math.max(0.65, rawBox.width * 0.11);
    const padY = Math.max(0.65, rawBox.height * 0.11);
    const left = clampPercent(rawBox.x - padX, projectionZone.x, projectionZone.x + projectionZone.width);
    const top = clampPercent(rawBox.y - padY, projectionZone.y, projectionZone.y + projectionZone.height);
    const right = clampPercent(rawBox.x + rawBox.width + padX, projectionZone.x, projectionZone.x + projectionZone.width);
    const bottom = clampPercent(rawBox.y + rawBox.height + padY, projectionZone.y, projectionZone.y + projectionZone.height);
    const box = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    const centerY = box.y + box.height / 2;
    if (box.width < Math.max(3.5, projectionZone.width * 0.042)) return;
    if (box.height < Math.max(3.5, projectionZone.height * 0.055)) return;
    if (area < projectionArea * 0.003 || area > projectionArea * 0.24) return;
    if (aspect < 0.16 || aspect > 6.2) return;
    if (centerY > projectionZone.y + projectionZone.height * 0.94) return;
    if (box.x <= projectionZone.x + projectionZone.width * 0.008 || box.x + box.width >= projectionZone.x + projectionZone.width * 0.992) return;
    if (box.y <= projectionZone.y + projectionZone.height * 0.008 || box.y + box.height >= projectionZone.y + projectionZone.height * 0.992) return;

    const support = countSupport(box);
    const edgeDensity = edgeCells / Math.max(area, 0.01);
    const meanStrength = rawStrength / Math.max(edgeCells, 1);
    const rectangleLike = support.sides >= 2 && edgeDensity >= 1.0;
    const roundOrTriangleLike = edgeCells >= 24 && edgeDensity >= 0.55 && support.sides >= 1;
    if (!rectangleLike && !roundOrTriangleLike) return;

    candidates.push({
      box,
      points: [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height }
      ],
      score: edgeCells * 3 + support.sides * 130 + edgeDensity * 70 + meanStrength * 0.18 - area * 0.18
    });
  };

  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      const startCell = idx(x, y);
      if (!connected[startCell] || visited[startCell]) continue;
      const queue = [startCell];
      visited[startCell] = 1;
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      let cells = 0;
      let edgeCells = 0;
      let rawStrength = 0;
      while (queue.length) {
        const current = queue.pop()!;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        cells += 1;
        if (edge[current]) {
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
          if (!connected[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (edgeCells < 12 || cells < 18) continue;
      makeBoxCandidate(x0, y0, x1, y1, edgeCells, rawStrength);
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.40;
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
console.log("auto masks now use edge perimeter components");
