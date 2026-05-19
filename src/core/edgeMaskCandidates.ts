import type { EdgePoint } from "../edgeDetect";

export type EdgeMaskCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

type CellComponent = {
  cells: Array<[number, number]>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function overlaps(a: EdgeMaskCandidate, b: EdgeMaskCandidate) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 && (ix * iy) / smaller > 0.62;
}

function makeCandidate(x: number, y: number, width: number, height: number, confidence: number): EdgeMaskCandidate | null {
  const area = width * height;
  const aspect = width / Math.max(0.01, height);
  if (width < 4 || height < 4 || area < 28 || area > 1750) return null;
  if (aspect < 0.22 || aspect > 5.0) return null;
  const px = Number(clamp(x - 0.45).toFixed(2));
  const py = Number(clamp(y - 0.45).toFixed(2));
  const pw = Number(clamp(width + 0.9, 0, 100 - px).toFixed(2));
  const ph = Number(clamp(height + 0.9, 0, 100 - py).toFixed(2));
  return { x: px, y: py, width: pw, height: ph, confidence: Number(confidence.toFixed(2)) };
}

function componentToCandidate(component: CellComponent, cellSize: number): EdgeMaskCandidate | null {
  const x = component.minX * cellSize;
  const y = component.minY * cellSize;
  const width = (component.maxX - component.minX + 1) * cellSize;
  const height = (component.maxY - component.minY + 1) * cellSize;

  if (component.cells.length < 8) return null;

  const cells = new Set(component.cells.map(([cx, cy]) => `${cx},${cy}`));
  const widthCells = component.maxX - component.minX + 1;
  const heightCells = component.maxY - component.minY + 1;

  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;

  for (let cx = component.minX; cx <= component.maxX; cx += 1) {
    if (cells.has(`${cx},${component.minY}`)) top += 1;
    if (cells.has(`${cx},${component.maxY}`)) bottom += 1;
  }
  for (let cy = component.minY; cy <= component.maxY; cy += 1) {
    if (cells.has(`${component.minX},${cy}`)) left += 1;
    if (cells.has(`${component.maxX},${cy}`)) right += 1;
  }

  const sideHits = [
    top / Math.max(1, widthCells),
    bottom / Math.max(1, widthCells),
    left / Math.max(1, heightCells),
    right / Math.max(1, heightCells)
  ];
  const strongSides = sideHits.filter((score) => score >= 0.12).length;
  const borderScore = sideHits.reduce((sum, score) => sum + score, 0) / 4;
  const fillDensity = component.cells.length / Math.max(1, widthCells * heightCells);

  if (strongSides < 2) return null;
  if (borderScore < 0.08) return null;
  if (fillDensity > 0.86 && width * height > 85) return null;

  return makeCandidate(x, y, width, height, Math.min(0.99, borderScore + Math.min(0.38, component.cells.length / 85)));
}

function buildComponents(edgePoints: EdgePoint[], cellSize: number): CellComponent[] {
  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const threshold = Math.max(44, strengths[Math.floor(strengths.length * 0.42)] ?? 44);
  const occupied = new Set<string>();

  for (const point of edgePoints) {
    if (point.strength < threshold) continue;
    occupied.add(`${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`);
  }

  const visited = new Set<string>();
  const components: CellComponent[] = [];
  const neighbors: Array<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

  for (const key of occupied) {
    if (visited.has(key)) continue;
    const [startX, startY] = key.split(",").map(Number);
    const queue: Array<[number, number]> = [[startX, startY]];
    const cells: Array<[number, number]> = [];
    visited.add(key);
    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    while (queue.length) {
      const [x, y] = queue.shift() as [number, number];
      cells.push([x, y]);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (const [ox, oy] of neighbors) {
        const next = `${x + ox},${y + oy}`;
        if (!occupied.has(next) || visited.has(next)) continue;
        visited.add(next);
        queue.push([x + ox, y + oy]);
      }
    }

    components.push({ cells, minX, maxX, minY, maxY });
  }

  return components;
}

function rectangleOutlineCandidates(edgePoints: EdgePoint[], limit: number): EdgeMaskCandidate[] {
  const cell = 1.35;
  const cols = Math.ceil(100 / cell);
  const rows = Math.ceil(100 / cell);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const threshold = Math.max(42, strengths[Math.floor(strengths.length * 0.38)] ?? 42);
  for (const point of edgePoints) {
    if (point.strength < threshold) continue;
    const x = Math.max(0, Math.min(cols - 1, Math.floor(point.x / cell)));
    const y = Math.max(0, Math.min(rows - 1, Math.floor(point.y / cell)));
    grid[y][x] += 1;
  }

  const candidates: EdgeMaskCandidate[] = [];
  const minW = Math.ceil(7 / cell);
  const maxW = Math.ceil(34 / cell);
  const minH = Math.ceil(7 / cell);
  const maxH = Math.ceil(42 / cell);

  for (let top = 0; top < rows - minH; top += 1) {
    for (let bottom = top + minH; bottom < Math.min(rows, top + maxH); bottom += 1) {
      for (let left = 0; left < cols - minW; left += 1) {
        for (let right = left + minW; right < Math.min(cols, left + maxW); right += 1) {
          const wCells = right - left + 1;
          const hCells = bottom - top + 1;
          let topHits = 0;
          let bottomHits = 0;
          let leftHits = 0;
          let rightHits = 0;
          let interiorHits = 0;

          for (let x = left; x <= right; x += 1) {
            if (grid[top][x] > 0) topHits += 1;
            if (grid[bottom][x] > 0) bottomHits += 1;
          }
          for (let y = top; y <= bottom; y += 1) {
            if (grid[y][left] > 0) leftHits += 1;
            if (grid[y][right] > 0) rightHits += 1;
          }
          for (let y = top + 1; y < bottom; y += 1) {
            for (let x = left + 1; x < right; x += 1) {
              if (grid[y][x] > 0) interiorHits += 1;
            }
          }

          const sideHits = [topHits / wCells, bottomHits / wCells, leftHits / hCells, rightHits / hCells];
          const strongSides = sideHits.filter((score) => score >= 0.28).length;
          const borderScore = sideHits.reduce((sum, score) => sum + score, 0) / 4;
          const interiorDensity = interiorHits / Math.max(1, (wCells - 2) * (hCells - 2));
          if (strongSides < 3) continue;
          if (borderScore < 0.28) continue;
          if (interiorDensity > 0.42) continue;

          const candidate = makeCandidate(left * cell, top * cell, wCells * cell, hCells * cell, Math.min(0.99, borderScore + 0.25));
          if (candidate) candidates.push(candidate);
        }
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 12): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  const cellSize = 1.35;
  const componentCandidates = buildComponents(edgePoints, cellSize)
    .map((component) => componentToCandidate(component, cellSize))
    .filter((candidate): candidate is EdgeMaskCandidate => Boolean(candidate));
  const outlineCandidates = rectangleOutlineCandidates(edgePoints, limit);
  const candidates = [...outlineCandidates, ...componentCandidates]
    .sort((a, b) => b.confidence - a.confidence);

  const unique: EdgeMaskCandidate[] = [];
  for (const candidate of candidates) {
    if (unique.some((existing) => overlaps(existing, candidate))) continue;
    unique.push(candidate);
    if (unique.length >= limit) break;
  }
  return unique;
}
