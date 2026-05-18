import type { EdgePoint } from "../edgeDetect";

export type EdgeMaskCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function overlaps(a: EdgeMaskCandidate, b: EdgeMaskCandidate) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 && intersection / smaller > 0.45;
}

function uniqueCandidates(candidates: EdgeMaskCandidate[], limit: number) {
  const sorted = candidates
    .filter((c) => c.width > 1.6 && c.height > 1.6)
    .sort((a, b) => b.confidence - a.confidence);
  const unique: EdgeMaskCandidate[] = [];
  for (const candidate of sorted) {
    if (unique.some((existing) => overlaps(existing, candidate))) continue;
    unique.push(candidate);
    if (unique.length >= limit) break;
  }
  return unique;
}

function makeCandidate(minX: number, maxX: number, minY: number, maxY: number, cellSize: number, count: number): EdgeMaskCandidate | null {
  const padding = 1.2;
  const x = clamp(minX * cellSize - padding);
  const y = clamp(minY * cellSize - padding);
  const width = clamp((maxX - minX + 1) * cellSize + padding * 2, 0, 100 - x);
  const height = clamp((maxY - minY + 1) * cellSize + padding * 2, 0, 100 - y);
  const area = width * height;
  if (count < 3 || width < 1.8 || height < 1.8 || area < 6 || area > 2200) return null;
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    confidence: Number(Math.min(0.99, count / Math.max(8, area)).toFixed(2))
  };
}

function rectangleOutlineCandidates(edgePoints: EdgePoint[], limit: number): EdgeMaskCandidate[] {
  const cell = 2;
  const cols = Math.ceil(100 / cell);
  const rows = Math.ceil(100 / cell);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (const point of edgePoints) {
    const x = Math.min(cols - 1, Math.max(0, Math.floor(point.x / cell)));
    const y = Math.min(rows - 1, Math.max(0, Math.floor(point.y / cell)));
    grid[y][x] += point.strength;
  }

  const rowScore = grid.map((row) => row.reduce((sum, value) => sum + value, 0));
  const colScore = Array.from({ length: cols }, (_, x) => grid.reduce((sum, row) => sum + row[x], 0));
  const rowThreshold = Math.max(...rowScore) * 0.18;
  const colThreshold = Math.max(...colScore) * 0.18;
  const strongRows = rowScore.map((score, index) => score > rowThreshold ? index : -1).filter((index) => index >= 0);
  const strongCols = colScore.map((score, index) => score > colThreshold ? index : -1).filter((index) => index >= 0);
  const candidates: EdgeMaskCandidate[] = [];

  for (let ri = 0; ri < strongRows.length; ri += 1) {
    for (let rj = ri + 1; rj < strongRows.length; rj += 1) {
      const top = strongRows[ri];
      const bottom = strongRows[rj];
      const h = (bottom - top) * cell;
      if (h < 6 || h > 70) continue;

      for (let ci = 0; ci < strongCols.length; ci += 1) {
        for (let cj = ci + 1; cj < strongCols.length; cj += 1) {
          const left = strongCols[ci];
          const right = strongCols[cj];
          const w = (right - left) * cell;
          if (w < 6 || w > 70) continue;

          let topHits = 0;
          let bottomHits = 0;
          let leftHits = 0;
          let rightHits = 0;
          for (let x = left; x <= right; x += 1) {
            topHits += grid[top]?.[x] ?? 0;
            bottomHits += grid[bottom]?.[x] ?? 0;
          }
          for (let y = top; y <= bottom; y += 1) {
            leftHits += grid[y]?.[left] ?? 0;
            rightHits += grid[y]?.[right] ?? 0;
          }

          const edgeScore = topHits + bottomHits + leftHits + rightHits;
          const perimeter = Math.max(1, (w + h) * 2);
          const confidence = Math.min(0.98, edgeScore / (perimeter * 160));
          if (confidence < 0.2) continue;

          candidates.push({
            x: Number(clamp(left * cell - 1).toFixed(2)),
            y: Number(clamp(top * cell - 1).toFixed(2)),
            width: Number(clamp(w + 2, 0, 100 - left * cell).toFixed(2)),
            height: Number(clamp(h + 2, 0, 100 - top * cell).toFixed(2)),
            confidence: Number(confidence.toFixed(2))
          });
        }
      }
    }
  }

  return uniqueCandidates(candidates, limit);
}

function clusterCandidates(edgePoints: EdgePoint[], limit: number): EdgeMaskCandidate[] {
  const cellSize = 3;
  const occupied = new Set<string>();
  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const dynamicThreshold = Math.max(48, strengths[Math.floor(strengths.length * 0.52)] ?? 48);

  for (const point of edgePoints) {
    if (point.strength < dynamicThreshold) continue;
    occupied.add(`${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`);
  }

  const visited = new Set<string>();
  const candidates: EdgeMaskCandidate[] = [];
  const neighbors: Array<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

  for (const key of occupied) {
    if (visited.has(key)) continue;
    const [startX, startY] = key.split(",").map(Number);
    const queue: Array<[number, number]> = [[startX, startY]];
    visited.add(key);
    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;
    let count = 0;

    while (queue.length) {
      const [x, y] = queue.shift() as [number, number];
      count += 1;
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

    const candidate = makeCandidate(minX, maxX, minY, maxY, cellSize, count);
    if (candidate) candidates.push(candidate);
  }

  return uniqueCandidates(candidates, limit);
}

function coarseFallback(edgePoints: EdgePoint[], limit: number): EdgeMaskCandidate[] {
  const grid = new Map<string, number>();
  const coarse = 10;
  for (const point of edgePoints) {
    const key = `${Math.floor(point.x / coarse)},${Math.floor(point.y / coarse)}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  }
  return [...grid.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => {
      const [gx, gy] = key.split(",").map(Number);
      return {
        x: clamp(gx * coarse),
        y: clamp(gy * coarse),
        width: clamp(coarse, 0, 100 - gx * coarse),
        height: clamp(coarse, 0, 100 - gy * coarse),
        confidence: Number(Math.min(0.99, count / 120).toFixed(2))
      };
    });
}

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 24): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  const rectangles = rectangleOutlineCandidates(edgePoints, Math.ceil(limit * 0.65));
  const clusters = clusterCandidates(edgePoints, limit);
  const combined = uniqueCandidates([...rectangles, ...clusters], limit);
  return combined.length ? combined : coarseFallback(edgePoints, limit);
}
