import type { EdgePoint } from "../edgeDetect";

export type EdgeMaskCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function makeCandidate(minX: number, maxX: number, minY: number, maxY: number, cellSize: number, count: number): EdgeMaskCandidate | null {
  const padding = 1.4;
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

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 24): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];

  const cellSize = 3;
  const occupied = new Set<string>();

  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const dynamicThreshold = Math.max(55, strengths[Math.floor(strengths.length * 0.58)] ?? 55);

  for (const point of edgePoints) {
    if (point.strength < dynamicThreshold) continue;
    occupied.add(`${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`);
  }

  if (!occupied.size) {
    for (const point of edgePoints) {
      occupied.add(`${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`);
    }
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

  if (candidates.length) {
    return candidates
      .sort((a, b) => (b.confidence * b.width * b.height) - (a.confidence * a.width * a.height))
      .slice(0, limit);
  }

  const grid = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; count: number }>();
  const coarse = 10;
  for (const point of edgePoints) {
    const gx = Math.floor(point.x / coarse);
    const gy = Math.floor(point.y / coarse);
    const key = `${gx},${gy}`;
    const bucket = grid.get(key) ?? { minX: gx, maxX: gx, minY: gy, maxY: gy, count: 0 };
    bucket.count += 1;
    grid.set(key, bucket);
  }

  return [...grid.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) => ({
      x: clamp(bucket.minX * coarse),
      y: clamp(bucket.minY * coarse),
      width: clamp(coarse, 0, 100 - bucket.minX * coarse),
      height: clamp(coarse, 0, 100 - bucket.minY * coarse),
      confidence: Number(Math.min(0.99, bucket.count / 120).toFixed(2))
    }));
}
