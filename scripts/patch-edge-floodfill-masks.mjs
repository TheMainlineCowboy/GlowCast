import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const startMarker = "export function generateAutoMasks(";
const endMarker = "\nexport function drawProjectionWithMasks";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error("Could not find generateAutoMasks block to replace.");
}

const replacement = `function floodHullCross(o: Coordinate, a: Coordinate, b: Coordinate) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function floodPolygonBounds(points: Coordinate[]): ProjectionZone {
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

function floodConvexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [point.x.toFixed(3) + "," + point.y.toFixed(3), point])).values()]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 3) return unique;

  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && floodHullCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }

  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && floodHullCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function simplifyFloodPolygon(points: Coordinate[], maxPoints = 42): Coordinate[] {
  if (points.length <= maxPoints) return points.map((point) => ({ x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) }));
  const simplified: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    const point = points[Math.floor(i * step)];
    simplified.push({ x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) });
  }
  return simplified;
}

function expandFloodPolygon(points: Coordinate[], amount: number, projectionZone: ProjectionZone): Coordinate[] {
  const bounds = floodPolygonBounds(points);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    return {
      x: Number(Math.max(projectionZone.x, Math.min(projectionZone.x + projectionZone.width, point.x + (dx / distance) * amount)).toFixed(2)),
      y: Number(Math.max(projectionZone.y, Math.min(projectionZone.y + projectionZone.height, point.y + (dy / distance) * amount)).toFixed(2))
    };
  });
}

function floodOverlapRatio(a: ProjectionZone, b: ProjectionZone) {
  const overlap = overlapAmount(a, b);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return overlap / Math.max(minArea, 1);
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  if (!edgePoints.length || projectionArea <= 0) return [];

  const gridW = 260;
  const gridH = Math.max(90, Math.min(260, Math.round((projectionZone.height / Math.max(projectionZone.width, 1)) * gridW)));
  const total = gridW * gridH;
  const toIndex = (x: number, y: number) => y * gridW + x;
  const toGridX = (x: number) => Math.max(0, Math.min(gridW - 1, Math.round(((x - projectionZone.x) / projectionZone.width) * (gridW - 1))));
  const toGridY = (y: number) => Math.max(0, Math.min(gridH - 1, Math.round(((y - projectionZone.y) / projectionZone.height) * (gridH - 1))));
  const toWorld = (x: number, y: number): Coordinate => ({
    x: projectionZone.x + (x / Math.max(1, gridW - 1)) * projectionZone.width,
    y: projectionZone.y + (y / Math.max(1, gridH - 1)) * projectionZone.height
  });

  const sourceEdges = new Uint8Array(total);
  const strong = edgePoints.filter((point) => pointInsideBox(point, projectionZone) && point.strength >= 50);
  if (!strong.length) return [];

  const markDisk = (grid: Uint8Array, cx: number, cy: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= gridW || y < 0 || y >= gridH) continue;
        grid[toIndex(x, y)] = 1;
      }
    }
  };

  for (const point of strong) markDisk(sourceEdges, toGridX(point.x), toGridY(point.y), 1);

  const dilate = (input: Uint8Array, radius: number) => {
    const output = new Uint8Array(total);
    for (let y = 0; y < gridH; y += 1) {
      for (let x = 0; x < gridW; x += 1) {
        if (!input[toIndex(x, y)]) continue;
        markDisk(output, x, y, radius);
      }
    }
    return output;
  };

  // This is the important change: use the visible edge layer as a stencil.
  // Thickening the stencil closes tiny camera/compression gaps so flood fill can
  // separate object interiors from the outside wall area instead of requiring a
  // mathematically perfect unbroken outline.
  const blocked = dilate(dilate(sourceEdges, 2), 1);

  const outside = new Uint8Array(total);
  const queue: Array<{ x: number; y: number }> = [];
  const pushOutside = (x: number, y: number) => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return;
    const index = toIndex(x, y);
    if (outside[index] || blocked[index]) return;
    outside[index] = 1;
    queue.push({ x, y });
  };

  for (let x = 0; x < gridW; x += 1) {
    pushOutside(x, 0);
    pushOutside(x, gridH - 1);
  }
  for (let y = 0; y < gridH; y += 1) {
    pushOutside(0, y);
    pushOutside(gridW - 1, y);
  }

  while (queue.length) {
    const cell = queue.pop()!;
    pushOutside(cell.x + 1, cell.y);
    pushOutside(cell.x - 1, cell.y);
    pushOutside(cell.x, cell.y + 1);
    pushOutside(cell.x, cell.y - 1);
  }

  const candidates: Array<{ points: Coordinate[]; box: ProjectionZone; score: number; source: string }> = [];
  const minCells = Math.max(24, Math.round(total * 0.0009));
  const maxCells = Math.round(total * 0.30);
  const visited = new Uint8Array(total);

  const addCandidateFromCells = (cells: Array<{ x: number; y: number }>, source: string) => {
    if (cells.length < minCells || cells.length > maxCells) return;
    let minGX = gridW;
    let minGY = gridH;
    let maxGX = 0;
    let maxGY = 0;
    for (const cell of cells) {
      minGX = Math.min(minGX, cell.x);
      minGY = Math.min(minGY, cell.y);
      maxGX = Math.max(maxGX, cell.x);
      maxGY = Math.max(maxGY, cell.y);
    }

    const baseBox = floodPolygonBounds([toWorld(minGX, minGY), toWorld(maxGX, minGY), toWorld(maxGX, maxGY), toWorld(minGX, maxGY)]);
    const area = baseBox.width * baseBox.height;
    const aspect = baseBox.width / Math.max(baseBox.height, 0.01);
    if (baseBox.width < Math.max(4.0, projectionZone.width * 0.04)) return;
    if (baseBox.height < Math.max(3.0, projectionZone.height * 0.045)) return;
    if (area < Math.max(10, projectionArea * 0.0025) || area > projectionArea * 0.28) return;
    if (aspect < 0.16 || aspect > 6.5) return;

    const edgePad = Math.max(5, Math.round(Math.min(gridW, gridH) / 38));
    const pointCloud: Coordinate[] = [];

    // Keep the hole/interior cells, then add the actual surrounding edge pixels.
    // The hull then lands on the outside trim/border instead of the inner glass/open space.
    const sampleStep = Math.max(1, Math.floor(cells.length / 180));
    for (let i = 0; i < cells.length; i += sampleStep) pointCloud.push(toWorld(cells[i].x, cells[i].y));

    for (let y = Math.max(0, minGY - edgePad); y <= Math.min(gridH - 1, maxGY + edgePad); y += 1) {
      for (let x = Math.max(0, minGX - edgePad); x <= Math.min(gridW - 1, maxGX + edgePad); x += 1) {
        if (!sourceEdges[toIndex(x, y)] && !blocked[toIndex(x, y)]) continue;
        pointCloud.push(toWorld(x, y));
      }
    }

    const hull = simplifyFloodPolygon(floodConvexHull(pointCloud));
    if (hull.length < 3) return;
    const expanded = expandFloodPolygon(hull, Math.max(0.25, Math.min(baseBox.width, baseBox.height) * 0.045), projectionZone);
    const box = floodPolygonBounds(expanded);
    candidates.push({ points: expanded, box, score: cells.length + area * (source === "hole" ? 2.0 : 0.8), source });
  };

  // Primary path: fill closed regions made by the edge stencil.
  for (let startY = 1; startY < gridH - 1; startY += 1) {
    for (let startX = 1; startX < gridW - 1; startX += 1) {
      const startIndex = toIndex(startX, startY);
      if (visited[startIndex] || blocked[startIndex] || outside[startIndex]) continue;
      const componentQueue = [{ x: startX, y: startY }];
      visited[startIndex] = 1;
      const cells: Array<{ x: number; y: number }> = [];
      while (componentQueue.length) {
        const cell = componentQueue.pop()!;
        cells.push(cell);
        const neighbors = [
          { x: cell.x + 1, y: cell.y },
          { x: cell.x - 1, y: cell.y },
          { x: cell.x, y: cell.y + 1 },
          { x: cell.x, y: cell.y - 1 }
        ];
        for (const next of neighbors) {
          if (next.x <= 0 || next.x >= gridW - 1 || next.y <= 0 || next.y >= gridH - 1) continue;
          const nextIndex = toIndex(next.x, next.y);
          if (visited[nextIndex] || blocked[nextIndex] || outside[nextIndex]) continue;
          visited[nextIndex] = 1;
          componentQueue.push(next);
        }
      }
      addCandidateFromCells(cells, "hole");
    }
  }

  // Fallback path: if an object outline is visibly present but has a small gap,
  // use the connected edge component itself. This prevents the all-or-nothing
  // failure where Edge-only View looks correct but Create Edge Mask Candidates says 0.
  const edgeVisited = new Uint8Array(total);
  for (let startY = 1; startY < gridH - 1; startY += 1) {
    for (let startX = 1; startX < gridW - 1; startX += 1) {
      const startIndex = toIndex(startX, startY);
      if (edgeVisited[startIndex] || !blocked[startIndex]) continue;
      const componentQueue = [{ x: startX, y: startY }];
      edgeVisited[startIndex] = 1;
      const cells: Array<{ x: number; y: number }> = [];
      while (componentQueue.length) {
        const cell = componentQueue.pop()!;
        cells.push(cell);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            if (nx <= 0 || nx >= gridW - 1 || ny <= 0 || ny >= gridH - 1) continue;
            const nextIndex = toIndex(nx, ny);
            if (edgeVisited[nextIndex] || !blocked[nextIndex]) continue;
            edgeVisited[nextIndex] = 1;
            componentQueue.push({ x: nx, y: ny });
          }
        }
      }
      addCandidateFromCells(cells, "component");
    }
  }

  const accepted: Array<{ points: Coordinate[]; box: ProjectionZone; score: number; source: string }> = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (accepted.some((existing) => floodOverlapRatio(existing.box, candidate.box) > 0.32)) continue;
    // Do not keep candidates that are basically the entire selected surface or surface border.
    if (candidate.box.width > projectionZone.width * 0.72 || candidate.box.height > projectionZone.height * 0.82) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted.map((candidate, index) => ({
    id: "auto_mask_" + String(Date.now()) + "_" + String(index),
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points,
    boundingBox: {
      x: Number(candidate.box.x.toFixed(2)),
      y: Number(candidate.box.y.toFixed(2)),
      width: Number(candidate.box.width.toFixed(2)),
      height: Number(candidate.box.height.toFixed(2))
    },
    enabled: true
  }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge mask candidates now use robust edge-stencil flood fill with component fallback");
