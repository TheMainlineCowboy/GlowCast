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
  return smaller > 0 && (ix * iy) / smaller > 0.55;
}

function componentToCandidate(component: CellComponent, cellSize: number): EdgeMaskCandidate | null {
  const x = component.minX * cellSize;
  const y = component.minY * cellSize;
  const width = (component.maxX - component.minX + 1) * cellSize;
  const height = (component.maxY - component.minY + 1) * cellSize;
  const area = width * height;
  const aspect = width / Math.max(0.01, height);

  if (component.cells.length < 12) return null;
  if (width < 4 || height < 4 || area < 24 || area > 1700) return null;
  if (aspect < 0.18 || aspect > 5.5) return null;

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
  const strongSides = sideHits.filter((score) => score >= 0.16).length;
  const borderScore = sideHits.reduce((sum, score) => sum + score, 0) / 4;
  const fillDensity = component.cells.length / Math.max(1, widthCells * heightCells);

  if (strongSides < 2) return null;
  if (borderScore < 0.10) return null;
  if (fillDensity > 0.82 && area > 80) return null;

  const px = Number(clamp(x - 0.6).toFixed(2));
  const py = Number(clamp(y - 0.6).toFixed(2));
  const pw = Number(clamp(width + 1.2, 0, 100 - px).toFixed(2));
  const ph = Number(clamp(height + 1.2, 0, 100 - py).toFixed(2));

  return {
    x: px,
    y: py,
    width: pw,
    height: ph,
    confidence: Number(Math.min(0.99, borderScore + Math.min(0.35, component.cells.length / 90)).toFixed(2))
  };
}

function buildComponents(edgePoints: EdgePoint[], cellSize: number): CellComponent[] {
  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const threshold = Math.max(52, strengths[Math.floor(strengths.length * 0.52)] ?? 52);
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

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 12): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  const cellSize = 1.35;
  const candidates = buildComponents(edgePoints, cellSize)
    .map((component) => componentToCandidate(component, cellSize))
    .filter((candidate): candidate is EdgeMaskCandidate => Boolean(candidate))
    .sort((a, b) => b.confidence - a.confidence);

  const unique: EdgeMaskCandidate[] = [];
  for (const candidate of candidates) {
    if (unique.some((existing) => overlaps(existing, candidate))) continue;
    unique.push(candidate);
    if (unique.length >= limit) break;
  }
  return unique;
}
