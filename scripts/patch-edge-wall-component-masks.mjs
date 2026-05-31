import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const startMarker = "type FilledOutlineCandidate = {";
const endMarker = "\nexport function drawProjectionWithMasks";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error("Could not find filled outline mask block to replace with wall-component masks.");
}

const replacement = `type FilledOutlineCandidate = {
  points: Coordinate[];
  boundingBox: ProjectionZone;
  cellCount: number;
  wallCount: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rasterIndex(x: number, y: number, width: number) {
  return y * width + x;
}

function drawRasterDisk(grid: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    if (y < 0 || y >= height) continue;
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || x >= width) continue;
      if (Math.hypot(x - cx, y - cy) <= radius + 0.15) grid[rasterIndex(x, y, width)] = 1;
    }
  }
}

function dilateRaster(grid: Uint8Array, width: number, height: number, radius: number) {
  const next = new Uint8Array(grid);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!grid[rasterIndex(x, y, width)]) continue;
      drawRasterDisk(next, width, height, x, y, radius);
    }
  }
  return next;
}

function boundsFromPoints(points: Coordinate[]): ProjectionZone {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function hullCross(o: Coordinate, a: Coordinate, b: Coordinate) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [String(point.x.toFixed(3)) + "," + String(point.y.toFixed(3)), point])).values()]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 3) return unique;

  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && hullCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }

  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && hullCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function simplifyPolygon(points: Coordinate[], maxPoints = 44): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const output: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) output.push(points[Math.floor(i * step)]);
  return output;
}

function expandPolygon(points: Coordinate[], amount: number, projectionZone: ProjectionZone): Coordinate[] {
  const bounds = boundsFromPoints(points);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    return {
      x: Number(clampNumber(point.x + (dx / distance) * amount, projectionZone.x, projectionZone.x + projectionZone.width).toFixed(2)),
      y: Number(clampNumber(point.y + (dy / distance) * amount, projectionZone.y, projectionZone.y + projectionZone.height).toFixed(2))
    };
  });
}

function finalSafetyExpansionAmount(box: ProjectionZone, projectionZone: ProjectionZone) {
  const objectSize = Math.min(box.width, box.height);
  const wallRelativeMinimum = Math.min(projectionZone.width, projectionZone.height) * 0.008;
  const objectRelative = objectSize * 0.08;
  return Math.max(0.18, wallRelativeMinimum, Math.min(objectRelative, 0.9));
}

function gridPointToProjection(x: number, y: number, width: number, height: number, projectionZone: ProjectionZone): Coordinate {
  return {
    x: projectionZone.x + (x / Math.max(1, width - 1)) * projectionZone.width,
    y: projectionZone.y + (y / Math.max(1, height - 1)) * projectionZone.height
  };
}

function collectOuterWallComponent(
  seeds: number[],
  walls: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  projectionZone: ProjectionZone
): Coordinate[] {
  const componentWidth = Math.max(1, maxX - minX + 1);
  const componentHeight = Math.max(1, maxY - minY + 1);
  const pad = Math.ceil(Math.max(8, Math.min(46, Math.max(componentWidth, componentHeight) * 0.78)));
  const limitMinX = Math.max(1, minX - pad);
  const limitMaxX = Math.min(gridWidth - 2, maxX + pad);
  const limitMinY = Math.max(1, minY - pad);
  const limitMaxY = Math.min(gridHeight - 2, maxY + pad);
  const visited = new Uint8Array(gridWidth * gridHeight);
  const queue: number[] = [];
  const output: Coordinate[] = [];

  for (const seed of seeds) {
    const sx = seed % gridWidth;
    const sy = Math.floor(seed / gridWidth);
    if (sx < limitMinX || sx > limitMaxX || sy < limitMinY || sy > limitMaxY) continue;
    if (!walls[seed] || visited[seed]) continue;
    visited[seed] = 1;
    queue.push(seed);
  }

  while (queue.length) {
    const index = queue.pop()!;
    const x = index % gridWidth;
    const y = Math.floor(index / gridWidth);
    output.push(gridPointToProjection(x, y, gridWidth, gridHeight, projectionZone));

    const neighbors = [index + 1, index - 1, index + gridWidth, index - gridWidth, index + gridWidth + 1, index + gridWidth - 1, index - gridWidth + 1, index - gridWidth - 1];
    for (const next of neighbors) {
      if (next < 0 || next >= walls.length || visited[next] || !walls[next]) continue;
      const nx = next % gridWidth;
      const ny = Math.floor(next / gridWidth);
      if (nx < limitMinX || nx > limitMaxX || ny < limitMinY || ny > limitMaxY) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }

  return output;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  if (!edgePoints.length || projectionArea <= 0) return [];

  const gridWidth = 460;
  const gridHeight = clampNumber(Math.round(gridWidth * (projectionZone.height / Math.max(projectionZone.width, 0.01))), 120, 360);
  const edgeGrid = new Uint8Array(gridWidth * gridHeight);
  const innerPadX = Math.max(0.12, projectionZone.width * 0.002);
  const innerPadY = Math.max(0.12, projectionZone.height * 0.003);

  for (const point of edgePoints) {
    if (point.strength < 58) continue;
    if (point.x <= projectionZone.x + innerPadX || point.x >= projectionZone.x + projectionZone.width - innerPadX) continue;
    if (point.y <= projectionZone.y + innerPadY || point.y >= projectionZone.y + projectionZone.height - innerPadY) continue;
    const gx = Math.round(((point.x - projectionZone.x) / projectionZone.width) * (gridWidth - 1));
    const gy = Math.round(((point.y - projectionZone.y) / projectionZone.height) * (gridHeight - 1));
    const radius = point.strength >= 125 ? 2 : 1;
    drawRasterDisk(edgeGrid, gridWidth, gridHeight, gx, gy, radius);
  }

  const walls = dilateRaster(dilateRaster(edgeGrid, gridWidth, gridHeight, 1), gridWidth, gridHeight, 1);
  const outside = new Uint8Array(gridWidth * gridHeight);
  const outsideQueue: number[] = [];

  function pushOutside(x: number, y: number) {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
    const index = rasterIndex(x, y, gridWidth);
    if (outside[index] || walls[index]) return;
    outside[index] = 1;
    outsideQueue.push(index);
  }

  for (let x = 0; x < gridWidth; x += 1) {
    pushOutside(x, 0);
    pushOutside(x, gridHeight - 1);
  }
  for (let y = 0; y < gridHeight; y += 1) {
    pushOutside(0, y);
    pushOutside(gridWidth - 1, y);
  }

  while (outsideQueue.length) {
    const index = outsideQueue.pop()!;
    const x = index % gridWidth;
    const y = Math.floor(index / gridWidth);
    pushOutside(x + 1, y);
    pushOutside(x - 1, y);
    pushOutside(x, y + 1);
    pushOutside(x, y - 1);
  }

  const visitedInterior = new Uint8Array(gridWidth * gridHeight);
  const candidates: FilledOutlineCandidate[] = [];
  const minCellCount = Math.max(18, Math.round(gridWidth * gridHeight * 0.00045));

  for (let y = 1; y < gridHeight - 1; y += 1) {
    for (let x = 1; x < gridWidth - 1; x += 1) {
      const startIndex = rasterIndex(x, y, gridWidth);
      if (visitedInterior[startIndex] || outside[startIndex] || walls[startIndex]) continue;

      const componentQueue = [startIndex];
      visitedInterior[startIndex] = 1;
      const cells: number[] = [];
      const wallSeeds = new Set<number>();
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (componentQueue.length) {
        const index = componentQueue.pop()!;
        cells.push(index);
        const cx = index % gridWidth;
        const cy = Math.floor(index / gridWidth);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [index + 1, index - 1, index + gridWidth, index - gridWidth];
        for (const next of neighbors) {
          if (next < 0 || next >= visitedInterior.length) continue;
          const nx = next % gridWidth;
          const ny = Math.floor(next / gridWidth);
          if (nx <= 0 || nx >= gridWidth - 1 || ny <= 0 || ny >= gridHeight - 1) continue;
          if (walls[next]) {
            wallSeeds.add(next);
            continue;
          }
          if (visitedInterior[next] || outside[next]) continue;
          visitedInterior[next] = 1;
          componentQueue.push(next);
        }
      }

      if (cells.length < minCellCount || wallSeeds.size < 6) continue;
      const topLeft = gridPointToProjection(minX, minY, gridWidth, gridHeight, projectionZone);
      const bottomRight = gridPointToProjection(maxX, maxY, gridWidth, gridHeight, projectionZone);
      const innerBox = {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y
      };
      const innerArea = innerBox.width * innerBox.height;
      const aspect = innerBox.width / Math.max(innerBox.height, 0.01);
      if (innerBox.width < Math.max(3.2, projectionZone.width * 0.035)) continue;
      if (innerBox.height < Math.max(3.2, projectionZone.height * 0.05)) continue;
      if (innerArea < Math.max(10, projectionArea * 0.0018) || innerArea > projectionArea * 0.18) continue;
      if (aspect < 0.18 || aspect > 5.8) continue;

      const outerWallPoints = collectOuterWallComponent([...wallSeeds], walls, gridWidth, gridHeight, minX, maxX, minY, maxY, projectionZone);
      const rawPoints = outerWallPoints.length >= 12
        ? outerWallPoints
        : [
            { x: innerBox.x, y: innerBox.y },
            { x: innerBox.x + innerBox.width, y: innerBox.y },
            { x: innerBox.x + innerBox.width, y: innerBox.y + innerBox.height },
            { x: innerBox.x, y: innerBox.y + innerBox.height }
          ];

      const hull = simplifyPolygon(convexHull(rawPoints));
      if (hull.length < 3) continue;
      const rawBoundingBox = boundsFromPoints(hull);
      const rawArea = rawBoundingBox.width * rawBoundingBox.height;
      if (rawArea < innerArea * 0.92 || rawArea > innerArea * 7.0 || rawArea > projectionArea * 0.26) continue;

      const expanded = expandPolygon(hull, finalSafetyExpansionAmount(rawBoundingBox, projectionZone), projectionZone);
      const boundingBox = boundsFromPoints(expanded);
      candidates.push({ points: expanded, boundingBox, cellCount: cells.length, wallCount: outerWallPoints.length });
    }
  }

  const accepted: FilledOutlineCandidate[] = [];
  const sorted = candidates.sort((a, b) => {
    const areaA = a.boundingBox.width * a.boundingBox.height;
    const areaB = b.boundingBox.width * b.boundingBox.height;
    return areaB - areaA || b.wallCount - a.wallCount || b.cellCount - a.cellCount;
  });

  for (const candidate of sorted) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.boundingBox, candidate.boundingBox);
      const minArea = Math.min(existing.boundingBox.width * existing.boundingBox.height, candidate.boundingBox.width * candidate.boundingBox.height);
      return overlap / Math.max(minArea, 1) > 0.28;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted.map((candidate, index) => ({
    id: "auto_mask_" + String(Date.now()) + "_" + String(index),
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points,
    boundingBox: {
      x: Number(candidate.boundingBox.x.toFixed(2)),
      y: Number(candidate.boundingBox.y.toFixed(2)),
      width: Number(candidate.boundingBox.width.toFixed(2)),
      height: Number(candidate.boundingBox.height.toFixed(2))
    },
    enabled: true
  }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now use the connected outer wall/trim component around each enclosed opening");
