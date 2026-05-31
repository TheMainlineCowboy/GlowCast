import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const helperNeedles = [
  "function componentHullCross(",
  "function contourClamp(",
  "function holeMaskClamp("
];
const functionNeedle = "export function generateAutoMasks(";
const endNeedle = "export function drawProjectionWithMasks(";
const functionStart = source.indexOf(functionNeedle);
const helperStarts = helperNeedles.map((needle) => source.indexOf(needle)).filter((index) => index !== -1 && index < functionStart);
const start = helperStarts.length ? Math.min(...helperStarts) : functionStart;
const end = source.indexOf(endNeedle, functionStart);
if (start === -1 || functionStart === -1 || end === -1) {
  throw new Error("Connected contour edge mask patch failed: generateAutoMasks block not found.");
}

const replacement = `export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  type HoleCandidate = {
    points: Coordinate[];
    boundingBox: ProjectionZone;
    areaCells: number;
    score: number;
  };

  const projectionArea = projectionZone.width * projectionZone.height;
  if (!edgePoints.length || projectionArea <= 0) return [];

  const runHolePass = (strengthFloor: number, dilation: number): HoleCandidate[] => {
    const cols = 150;
    const rows = Math.max(70, Math.round(cols * projectionZone.height / Math.max(projectionZone.width, 1)));
    const total = cols * rows;
    const edge = new Uint8Array(total);
    const blocked = new Uint8Array(total);
    const outside = new Uint8Array(total);

    const toIndex = (x: number, y: number) => y * cols + x;
    const toGridX = (x: number) => Math.round(((x - projectionZone.x) / projectionZone.width) * (cols - 1));
    const toGridY = (y: number) => Math.round(((y - projectionZone.y) / projectionZone.height) * (rows - 1));
    const toWorldX = (gx: number) => projectionZone.x + (gx / (cols - 1)) * projectionZone.width;
    const toWorldY = (gy: number) => projectionZone.y + (gy / (rows - 1)) * projectionZone.height;

    const marginX = Math.max(0.35, projectionZone.width * 0.006);
    const marginY = Math.max(0.35, projectionZone.height * 0.006);

    for (const point of edgePoints) {
      if (point.strength < strengthFloor) continue;
      if (point.x <= projectionZone.x + marginX || point.x >= projectionZone.x + projectionZone.width - marginX) continue;
      if (point.y <= projectionZone.y + marginY || point.y >= projectionZone.y + projectionZone.height - marginY) continue;

      const gx = holeMaskClamp(Math.round(toGridX(point.x)), 1, cols - 2);
      const gy = holeMaskClamp(Math.round(toGridY(point.y)), 1, rows - 2);
      edge[toIndex(gx, gy)] = 1;
    }

    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < cols - 1; x += 1) {
        if (!edge[toIndex(x, y)]) continue;
        for (let dy = -dilation; dy <= dilation; dy += 1) {
          for (let dx = -dilation; dx <= dilation; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            blocked[toIndex(nx, ny)] = 1;
          }
        }
      }
    }

    const queue: Array<[number, number]> = [];
    const addOutside = (x: number, y: number) => {
      const index = toIndex(x, y);
      if (outside[index] || blocked[index]) return;
      outside[index] = 1;
      queue.push([x, y]);
    };

    for (let x = 0; x < cols; x += 1) {
      addOutside(x, 0);
      addOutside(x, rows - 1);
    }
    for (let y = 0; y < rows; y += 1) {
      addOutside(0, y);
      addOutside(cols - 1, y);
    }

    while (queue.length) {
      const [x, y] = queue.pop()!;
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        addOutside(nx, ny);
      }
    }

    const seen = new Uint8Array(total);
    const candidates: HoleCandidate[] = [];
    const minWidth = Math.max(3.4, projectionZone.width * 0.045);
    const minHeight = Math.max(3.4, projectionZone.height * 0.065);

    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < cols - 1; x += 1) {
        const startIndex = toIndex(x, y);
        if (seen[startIndex] || outside[startIndex] || blocked[startIndex]) continue;

        const cells: Array<[number, number]> = [];
        const fillQueue: Array<[number, number]> = [[x, y]];
        seen[startIndex] = 1;
        let minGX = x;
        let maxGX = x;
        let minGY = y;
        let maxGY = y;

        while (fillQueue.length) {
          const [cx, cy] = fillQueue.pop()!;
          cells.push([cx, cy]);
          minGX = Math.min(minGX, cx);
          maxGX = Math.max(maxGX, cx);
          minGY = Math.min(minGY, cy);
          maxGY = Math.max(maxGY, cy);

          const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of neighbors) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx <= 0 || nx >= cols - 1 || ny <= 0 || ny >= rows - 1) continue;
            const nextIndex = toIndex(nx, ny);
            if (seen[nextIndex] || outside[nextIndex] || blocked[nextIndex]) continue;
            seen[nextIndex] = 1;
            fillQueue.push([nx, ny]);
          }
        }

        const x1 = toWorldX(minGX);
        const x2 = toWorldX(maxGX + 1);
        const y1 = toWorldY(minGY);
        const y2 = toWorldY(maxGY + 1);
        const width = x2 - x1;
        const height = y2 - y1;
        const area = width * height;
        const aspect = width / Math.max(height, 0.01);
        const fillRatio = cells.length / Math.max(1, (maxGX - minGX + 1) * (maxGY - minGY + 1));

        if (width < minWidth || height < minHeight) continue;
        if (area < projectionArea * 0.0038 || area > projectionArea * 0.2) continue;
        if (aspect < 0.22 || aspect > 5.2) continue;
        if (fillRatio < 0.35) continue;

        const padX = Math.max(0.25, width * 0.055);
        const padY = Math.max(0.25, height * 0.055);
        const box = {
          x: holeMaskClamp(x1 - padX, projectionZone.x, projectionZone.x + projectionZone.width),
          y: holeMaskClamp(y1 - padY, projectionZone.y, projectionZone.y + projectionZone.height),
          width: 0,
          height: 0
        };
        const right = holeMaskClamp(x2 + padX, projectionZone.x, projectionZone.x + projectionZone.width);
        const bottom = holeMaskClamp(y2 + padY, projectionZone.y, projectionZone.y + projectionZone.height);
        box.width = Math.max(0.01, right - box.x);
        box.height = Math.max(0.01, bottom - box.y);

        // A real enclosed object should not be created from the selected projection surface border.
        const touchesSurfaceBorder =
          box.x <= projectionZone.x + projectionZone.width * 0.01 ||
          box.y <= projectionZone.y + projectionZone.height * 0.01 ||
          box.x + box.width >= projectionZone.x + projectionZone.width * 0.99 ||
          box.y + box.height >= projectionZone.y + projectionZone.height * 0.99;
        if (touchesSurfaceBorder) continue;

        candidates.push({
          points: holeMaskBoxPoints(box),
          boundingBox: {
            x: Number(box.x.toFixed(2)),
            y: Number(box.y.toFixed(2)),
            width: Number(box.width.toFixed(2)),
            height: Number(box.height.toFixed(2))
          },
          areaCells: cells.length,
          score: cells.length + fillRatio * 100 - Math.abs(1 - aspect) * 8
        });
      }
    }

    return candidates;
  };

  let candidates = runHolePass(76, 1);
  if (candidates.length < 2) candidates = candidates.concat(runHolePass(62, 1));
  if (candidates.length < 2) candidates = candidates.concat(runHolePass(58, 2));

  const accepted: HoleCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.boundingBox, candidate.boundingBox);
      const smaller = Math.min(existing.boundingBox.width * existing.boundingBox.height, candidate.boundingBox.width * candidate.boundingBox.height);
      return overlap / Math.max(smaller, 0.01) > 0.42;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted.map((candidate, index) => ({
    id: \`auto_mask_\${Date.now()}_\${index}\`,
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points,
    boundingBox: candidate.boundingBox,
    enabled: true
  }));
}

function holeMaskClamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function holeMaskBoxPoints(box: ProjectionZone): Coordinate[] {
  return [
    { x: Number(box.x.toFixed(2)), y: Number(box.y.toFixed(2)) },
    { x: Number((box.x + box.width).toFixed(2)), y: Number(box.y.toFixed(2)) },
    { x: Number((box.x + box.width).toFixed(2)), y: Number((box.y + box.height).toFixed(2)) },
    { x: Number(box.x.toFixed(2)), y: Number((box.y + box.height).toFixed(2)) }
  ];
}

`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now come from flood-filled closed holes instead of connected-edge hull guesses");
