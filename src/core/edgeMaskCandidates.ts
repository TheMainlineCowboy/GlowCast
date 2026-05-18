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
  if (count < 3 || width < 1.8 || height < 1.8 || area < 6 || area > 1800) return null;
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    confidence: Number(Math.min(0.99, count / Math.max(8, area)).toFixed(2))
  };
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

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 18): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  const clusters = clusterCandidates(edgePoints, limit);
  return clusters.length ? clusters : coarseFallback(edgePoints, Math.min(limit, 8));
}
