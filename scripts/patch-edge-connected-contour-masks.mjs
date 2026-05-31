import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const startNeedle = "export function generateAutoMasks(";
const endNeedle = "export function drawProjectionWithMasks(";
const start = source.indexOf(startNeedle);
const end = source.indexOf(endNeedle, start);
if (start === -1 || end === -1) {
  throw new Error("Connected contour edge mask patch failed: generateAutoMasks block not found.");
}

const replacement = `export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  type Cell = { gx: number; gy: number; points: EdgePoint[]; count: number; strength: number };
  type Candidate = {
    points: Coordinate[];
    boundingBox: ProjectionZone;
    score: number;
    edgeCount: number;
  };

  const projectionArea = projectionZone.width * projectionZone.height;
  if (!edgePoints.length || projectionArea <= 0) return [];

  const marginX = Math.max(0.35, projectionZone.width * 0.006);
  const marginY = Math.max(0.35, projectionZone.height * 0.006);
  const minObjectWidth = Math.max(3.8, projectionZone.width * 0.055);
  const minObjectHeight = Math.max(3.8, projectionZone.height * 0.075);
  const cellSize = Math.max(0.24, Math.min(projectionZone.width, projectionZone.height) / 145);

  const inProjection = (point: EdgePoint) =>
    point.x >= projectionZone.x + marginX &&
    point.x <= projectionZone.x + projectionZone.width - marginX &&
    point.y >= projectionZone.y + marginY &&
    point.y <= projectionZone.y + projectionZone.height - marginY;

  const makeCandidates = (strengthFloor: number, bridgeRadius: number) => {
    const grid = new Map<string, Cell>();

    for (const point of edgePoints) {
      if (point.strength < strengthFloor || !inProjection(point)) continue;
      const gx = Math.floor((point.x - projectionZone.x) / cellSize);
      const gy = Math.floor((point.y - projectionZone.y) / cellSize);
      const key = gx + "," + gy;
      const current = grid.get(key);
      if (current) {
        current.points.push(point);
        current.count += 1;
        current.strength += point.strength;
      } else {
        grid.set(key, { gx, gy, points: [point], count: 1, strength: point.strength });
      }
    }

    const visited = new Set<string>();
    const rawCandidates: Candidate[] = [];

    for (const [firstKey, firstCell] of grid) {
      if (visited.has(firstKey)) continue;
      const queue = [firstCell];
      const componentPoints: EdgePoint[] = [];
      let edgeCount = 0;
      let totalStrength = 0;
      visited.add(firstKey);

      while (queue.length) {
        const cell = queue.pop()!;
        componentPoints.push(...cell.points);
        edgeCount += cell.count;
        totalStrength += cell.strength;

        for (let dx = -bridgeRadius; dx <= bridgeRadius; dx += 1) {
          for (let dy = -bridgeRadius; dy <= bridgeRadius; dy += 1) {
            if (dx === 0 && dy === 0) continue;
            const nextKey = cell.gx + dx + "," + (cell.gy + dy);
            if (visited.has(nextKey)) continue;
            const next = grid.get(nextKey);
            if (!next) continue;
            visited.add(nextKey);
            queue.push(next);
          }
        }
      }

      if (edgeCount < Math.max(14, _options.minPoints)) continue;

      const xs = componentPoints.map((point) => point.x);
      const ys = componentPoints.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;
      const area = width * height;
      const aspect = width / Math.max(height, 0.01);

      if (width < minObjectWidth || height < minObjectHeight) continue;
      if (area < projectionArea * 0.0045 || area > projectionArea * 0.34) continue;
      if (aspect < 0.18 || aspect > 5.5) continue;

      const sideBandX = Math.max(cellSize * 2.4, width * 0.16);
      const sideBandY = Math.max(cellSize * 2.4, height * 0.16);
      const top = componentPoints.filter((point) => Math.abs(point.y - minY) <= sideBandY).length;
      const bottom = componentPoints.filter((point) => Math.abs(point.y - maxY) <= sideBandY).length;
      const left = componentPoints.filter((point) => Math.abs(point.x - minX) <= sideBandX).length;
      const right = componentPoints.filter((point) => Math.abs(point.x - maxX) <= sideBandX).length;
      const sideMinimum = Math.max(2, edgeCount * 0.045);
      const sidesCovered = [top, bottom, left, right].filter((count) => count >= sideMinimum).length;
      if (sidesCovered < 3) continue;

      const hull = convexHull(componentPoints.map((point) => ({ x: point.x, y: point.y })));
      if (hull.length < 3) continue;

      const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      const pad = Math.max(0.25, Math.min(width, height) * 0.045);
      const paddedHull = hull.map((point) => {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
          x: clamp(point.x + (dx / len) * pad, projectionZone.x, projectionZone.x + projectionZone.width),
          y: clamp(point.y + (dy / len) * pad, projectionZone.y, projectionZone.y + projectionZone.height)
        };
      });
      const simplified = simplifyPolygon(paddedHull, 20);
      const finalBox = boundingBoxForPoints(simplified);
      const density = edgeCount / Math.max(area, 0.01);
      const strengthScore = totalStrength / Math.max(edgeCount, 1) / 255;

      rawCandidates.push({
        points: simplified,
        boundingBox: {
          x: Number(finalBox.x.toFixed(2)),
          y: Number(finalBox.y.toFixed(2)),
          width: Number(finalBox.width.toFixed(2)),
          height: Number(finalBox.height.toFixed(2))
        },
        edgeCount,
        score: sidesCovered * 4 + Math.min(8, density) + strengthScore * 4 + Math.min(3, edgeCount / 80)
      });
    }

    return rawCandidates;
  };

  let candidates = makeCandidates(72, 1);
  if (candidates.length < 2) candidates = [...candidates, ...makeCandidates(58, 1)];
  if (candidates.length < 2) candidates = [...candidates, ...makeCandidates(58, 2)];

  const accepted: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.boundingBox, candidate.boundingBox);
      const smaller = Math.min(existing.boundingBox.width * existing.boundingBox.height, candidate.boundingBox.width * candidate.boundingBox.height);
      return overlap / Math.max(smaller, 0.01) > 0.38;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted.map((candidate, index) => ({
    id: \`auto_mask_\${Date.now()}_\${index}\`,
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points.map((point) => ({ x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) })),
    boundingBox: candidate.boundingBox,
    enabled: true
  }));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function boundingBoxForPoints(points: Coordinate[]): ProjectionZone {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: Math.max(0.01, maxX - minX), height: Math.max(0.01, maxY - minY) };
}

function convexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [point.x.toFixed(2) + "," + point.y.toFixed(2), point])).values()]
    .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  if (unique.length <= 3) return unique;

  const cross = (o: Coordinate, a: Coordinate, b: Coordinate) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Coordinate[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function simplifyPolygon(points: Coordinate[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const simplified: Coordinate[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    simplified.push(points[Math.floor(i * step)]);
  }
  return simplified;
}

`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now come from connected contour hulls, not template guesses");
