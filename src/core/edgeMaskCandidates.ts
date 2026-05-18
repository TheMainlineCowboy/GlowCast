import type { EdgePoint } from "../edgeDetect";

export type EdgeMaskCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 18): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];

  const cellSize = 2.5;
  const occupied = new Set<string>();

  for (const point of edgePoints) {
    if (point.strength < 90) continue;
    occupied.add(`${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`);
  }

  const visited = new Set<string>();
  const candidates: EdgeMaskCandidate[] = [];

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

      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next = `${x + ox},${y + oy}`;
        if (!occupied.has(next) || visited.has(next)) continue;
        visited.add(next);
        queue.push([x + ox, y + oy]);
      }
    }

    const x = clamp(minX * cellSize - 0.6);
    const y = clamp(minY * cellSize - 0.6);
    const width = clamp((maxX - minX + 1) * cellSize + 1.2, 0, 100 - x);
    const height = clamp((maxY - minY + 1) * cellSize + 1.2, 0, 100 - y);
    const area = width * height;

    if (count < 8 || width < 2.4 || height < 2.4 || area < 12 || area > 1800) continue;

    candidates.push({
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
      confidence: Number(Math.min(0.99, count / Math.max(12, area)).toFixed(2))
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
