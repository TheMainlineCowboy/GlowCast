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
  const inner = {
    x: projectionZone.x + projectionZone.width * 0.018,
    y: projectionZone.y + projectionZone.height * 0.025,
    width: projectionZone.width * 0.964,
    height: projectionZone.height * 0.945
  };
  const projectionArea = projectionZone.width * projectionZone.height;
  const visiblePoints = edgePoints.filter((point) =>
    point.x >= inner.x && point.x <= inner.x + inner.width &&
    point.y >= inner.y && point.y <= inner.y + inner.height
  );
  if (!visiblePoints.length) return [];

  const strengths = visiblePoints.map((point) => point.strength).sort((a, b) => a - b);
  const mediumPercentile = strengths[Math.floor(strengths.length * 0.46)] ?? 60;
  const cutoff = Math.max(56, Math.min(92, mediumPercentile));
  const sourcePoints = visiblePoints.filter((point) => point.strength >= cutoff);
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

  const seed = new Uint8Array(total);
  const barrier = new Uint8Array(total);
  for (const point of sourcePoints) seed[idx(toGridX(point.x), toGridY(point.y))] = 1;

  // Convert the visible Edge-only layer into solid barriers. This closes small gaps in
  // windows/doors/shapes without using the original photo again.
  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      if (!seed[idx(x, y)]) continue;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx * dx + dy * dy > 10) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          barrier[idx(nx, ny)] = 1;
        }
      }
    }
  }

  // Flood-fill empty space from the outside of the projection surface. Anything not
  // reached is enclosed by the visible edge layer and is therefore mask-like.
  const outside = new Uint8Array(total);
  const queue: number[] = [];
  const addOutsideSeed = (x: number, y: number) => {
    if (x < minGX || x > maxGX || y < minGY || y > maxGY) return;
    const cell = idx(x, y);
    if (barrier[cell] || outside[cell]) return;
    outside[cell] = 1;
    queue.push(cell);
  };
  for (let x = minGX; x <= maxGX; x += 1) {
    addOutsideSeed(x, minGY);
    addOutsideSeed(x, maxGY);
  }
  for (let y = minGY; y <= maxGY; y += 1) {
    addOutsideSeed(minGX, y);
    addOutsideSeed(maxGX, y);
  }
  const dirs = [1, -1, gridW, -gridW];
  while (queue.length) {
    const current = queue.pop()!;
    const cx = current % gridW;
    const cy = Math.floor(current / gridW);
    for (const dir of dirs) {
      const next = current + dir;
      if (next < 0 || next >= total) continue;
      const nx = next % gridW;
      const ny = Math.floor(next / gridW);
      if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
      if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
      if (barrier[next] || outside[next]) continue;
      outside[next] = 1;
      queue.push(next);
    }
  }

  const holeVisited = new Uint8Array(total);
  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  const holeDirs = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];

  const edgeSupportAroundBox = (box: ProjectionZone) => {
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
        if (top + d >= minGY && top + d <= maxGY && barrier[idx(x, top + d)]) topHits += 1;
        if (bottom + d >= minGY && bottom + d <= maxGY && barrier[idx(x, bottom + d)]) bottomHits += 1;
      }
    }
    for (let y = top; y <= bottom; y += 1) {
      for (let d = -3; d <= 3; d += 1) {
        if (left + d >= minGX && left + d <= maxGX && barrier[idx(left + d, y)]) leftHits += 1;
        if (right + d >= minGX && right + d <= maxGX && barrier[idx(right + d, y)]) rightHits += 1;
      }
    }
    const horizontalNeed = Math.max(3, Math.round((right - left + 1) * 0.18));
    const verticalNeed = Math.max(3, Math.round((bottom - top + 1) * 0.18));
    let sides = 0;
    if (topHits >= horizontalNeed) sides += 1;
    if (bottomHits >= horizontalNeed) sides += 1;
    if (leftHits >= verticalNeed) sides += 1;
    if (rightHits >= verticalNeed) sides += 1;
    return sides;
  };

  for (let y = minGY + 1; y < maxGY; y += 1) {
    for (let x = minGX + 1; x < maxGX; x += 1) {
      const startCell = idx(x, y);
      if (barrier[startCell] || outside[startCell] || holeVisited[startCell]) continue;
      const component: number[] = [];
      const holeQueue = [startCell];
      holeVisited[startCell] = 1;
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      while (holeQueue.length) {
        const current = holeQueue.pop()!;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        component.push(current);
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const dir of holeDirs) {
          const next = current + dir;
          if (next < 0 || next >= total) continue;
          const nx = next % gridW;
          const ny = Math.floor(next / gridW);
          if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          if (barrier[next] || outside[next] || holeVisited[next]) continue;
          holeVisited[next] = 1;
          holeQueue.push(next);
        }
      }

      if (component.length < 24) continue;
      const rawBox = {
        x: toPercentX(x0),
        y: toPercentY(y0),
        width: toPercentX(x1) - toPercentX(x0),
        height: toPercentY(y1) - toPercentY(y0)
      };
      const padX = Math.max(0.7, rawBox.width * 0.16);
      const padY = Math.max(0.7, rawBox.height * 0.16);
      const box = {
        x: clampPercent(rawBox.x - padX, projectionZone.x, projectionZone.x + projectionZone.width),
        y: clampPercent(rawBox.y - padY, projectionZone.y, projectionZone.y + projectionZone.height),
        width: 0,
        height: 0
      };
      const maxX = clampPercent(rawBox.x + rawBox.width + padX, projectionZone.x, projectionZone.x + projectionZone.width);
      const maxY = clampPercent(rawBox.y + rawBox.height + padY, projectionZone.y, projectionZone.y + projectionZone.height);
      box.width = Math.max(0, maxX - box.x);
      box.height = Math.max(0, maxY - box.y);

      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      const centerY = box.y + box.height / 2;
      if (box.width < Math.max(3.6, projectionZone.width * 0.04)) continue;
      if (box.height < Math.max(3.6, projectionZone.height * 0.055)) continue;
      if (area < projectionArea * 0.003 || area > projectionArea * 0.20) continue;
      if (aspect < 0.18 || aspect > 5.8) continue;
      if (centerY > projectionZone.y + projectionZone.height * 0.93) continue;
      if (edgeSupportAroundBox(box) < 2) continue;

      candidates.push({
        box,
        points: [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
          { x: box.x, y: box.y + box.height }
        ],
        score: component.length + edgeSupportAroundBox(box) * 120 - area * 0.45
      });
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.38;
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
console.log("auto masks now detect enclosed regions inside the visible edge layer");
