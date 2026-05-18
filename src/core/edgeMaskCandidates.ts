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
    .filter((c) => c.width > 2.5 && c.height > 2.5)
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
  const padding = 0.9;
  const x = clamp(minX * cellSize - padding);
  const y = clamp(minY * cellSize - padding);
  const width = clamp((maxX - minX + 1) * cellSize + padding * 2, 0, 100 - x);
  const height = clamp((maxY - minY + 1) * cellSize + padding * 2, 0, 100 - y);
  const area = width * height;
  const density = count / Math.max(1, area);

  if (count < 6 || width < 2.5 || height < 2.5 || area < 12 || area > 900 || density < 0.08) return null;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    confidence: Number(Math.min(0.99, density).toFixed(2))
  };
}

function clusterCandidates(edgePoints: EdgePoint[], limit: number): EdgeMaskCandidate[] {
  const cellSize = 2.25;
  const occupied = new Set<string>();
  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const dynamicThreshold = Math.max(62, strengths[Math.floor(strengths.length * 0.68)] ?? 62);

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

export function edgePointsToMaskCandidates(edgePoints: EdgePoint[], limit = 12): EdgeMaskCandidate[] {
  if (!edgePoints.length) return [];
  return clusterCandidates(edgePoints, limit);
}
