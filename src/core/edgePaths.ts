import type { EdgePoint } from "../edgeDetect";

export type PathPoint = { x: number; y: number; strength?: number };
export type EdgePath = PathPoint[];

export type EdgePathConfig = {
  cellSize: number;
  maxNeighborCells: number;
  minPathPoints: number;
  simplifyTolerance: number;
  closureThreshold: number;
};

const defaultConfig: EdgePathConfig = {
  cellSize: 1.25,
  maxNeighborCells: 2,
  minPathPoints: 10,
  simplifyTolerance: 0.75,
  closureThreshold: 4.25
};

const dist = (a: PathPoint, b: PathPoint) => Math.hypot(a.x - b.x, a.y - b.y);

function perpendicularDistance(point: PathPoint, start: PathPoint, end: PathPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return dist(point, start);
  const numerator = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x);
  return numerator / Math.hypot(dx, dy);
}

export function simplifyPath(points: EdgePath, tolerance = defaultConfig.simplifyTolerance): EdgePath {
  if (points.length <= 3) return points;
  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) return [first, last];
  const left = simplifyPath(points.slice(0, index + 1), tolerance);
  const right = simplifyPath(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function keyFor(point: PathPoint, cellSize: number) {
  return `${Math.round(point.x / cellSize)},${Math.round(point.y / cellSize)}`;
}

function neighboringKeys(key: string, radius: number) {
  const [gx, gy] = key.split(",").map(Number);
  const keys: string[] = [];
  for (let y = gy - radius; y <= gy + radius; y += 1) {
    for (let x = gx - radius; x <= gx + radius; x += 1) {
      keys.push(`${x},${y}`);
    }
  }
  return keys;
}

export function buildEdgePaths(edgePoints: EdgePoint[], config: Partial<EdgePathConfig> = {}): EdgePath[] {
  const cfg = { ...defaultConfig, ...config };
  if (!edgePoints.length) return [];

  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const threshold = Math.max(48, strengths[Math.floor(strengths.length * 0.42)] ?? 48);
  const points = edgePoints
    .filter((point) => point.strength >= threshold)
    .map((point) => ({ x: point.x, y: point.y, strength: point.strength }));

  const buckets = new Map<string, PathPoint[]>();
  for (const point of points) {
    const key = keyFor(point, cfg.cellSize);
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }

  const visited = new Set<PathPoint>();
  const paths: EdgePath[] = [];

  const nearestUnvisited = (from: PathPoint) => {
    let best: PathPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const key of neighboringKeys(keyFor(from, cfg.cellSize), cfg.maxNeighborCells)) {
      const bucket = buckets.get(key);
      if (!bucket) continue;
      for (const candidate of bucket) {
        if (visited.has(candidate)) continue;
        const distance = dist(from, candidate);
        if (distance > 0 && distance < bestDistance && distance <= cfg.cellSize * cfg.maxNeighborCells * 1.45) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }
    return best;
  };

  for (const seed of points) {
    if (visited.has(seed)) continue;
    const path: EdgePath = [seed];
    visited.add(seed);

    let tip = seed;
    while (true) {
      const next = nearestUnvisited(tip);
      if (!next) break;
      visited.add(next);
      path.push(next);
      tip = next;
    }

    let head = seed;
    while (true) {
      const previous = nearestUnvisited(head);
      if (!previous) break;
      visited.add(previous);
      path.unshift(previous);
      head = previous;
    }

    if (path.length >= cfg.minPathPoints) {
      paths.push(simplifyPath(path, cfg.simplifyTolerance));
    }
  }

  return paths;
}

export function pathBounds(path: EdgePath) {
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  return { x, y, width, height };
}

export function isMostlyClosed(path: EdgePath, closureThreshold = defaultConfig.closureThreshold) {
  if (path.length < 4) return false;
  return dist(path[0], path[path.length - 1]) <= closureThreshold;
}

export function polygonArea(path: EdgePath) {
  if (path.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < path.length; i += 1) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}
