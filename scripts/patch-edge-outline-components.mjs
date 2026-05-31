import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const helperAnchor = "export function generateAutoMasks(";
const helperIndex = source.indexOf(helperAnchor);
if (helperIndex === -1) {
  throw new Error("Could not find generateAutoMasks anchor for outline component patch.");
}

const start = helperIndex;
const end = source.indexOf("\nexport function drawProjectionWithMasks", start);
if (end === -1) {
  throw new Error("Could not find drawProjectionWithMasks anchor for outline component patch.");
}

const replacement = `type EdgeOutlineCandidate = {
  points: Coordinate[];
  edgeCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function pointKey(x: number, y: number) {
  return \`\${x},\${y}\`;
}

function makeBounds(points: Coordinate[]): ProjectionZone {
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
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function cross(o: Coordinate, a: Coordinate, b: Coordinate) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Coordinate[]): Coordinate[] {
  const unique = [...new Map(points.map((point) => [\`\${point.x.toFixed(3)},\${point.y.toFixed(3)}\`, point])).values()]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 3) return unique;

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

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function simplifyOutline(points: Coordinate[], maxPoints = 28): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const simplified: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    simplified.push(points[Math.floor(i * step)]);
  }
  return simplified;
}

function expandOutline(points: Coordinate[], amount: number, projectionZone: ProjectionZone): Coordinate[] {
  const bounds = makeBounds(points);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const x = point.x + (dx / distance) * amount;
    const y = point.y + (dy / distance) * amount;
    return {
      x: Math.max(projectionZone.x, Math.min(projectionZone.x + projectionZone.width, Number(x.toFixed(2)))),
      y: Math.max(projectionZone.y, Math.min(projectionZone.y + projectionZone.height, Number(y.toFixed(2))))
    };
  });
}

function buildOutlineCandidatesFromEdges(edgePoints: EdgePoint[], projectionZone: ProjectionZone): EdgeOutlineCandidate[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  const cellSize = Math.max(0.28, Math.min(projectionZone.width, projectionZone.height) / 115);
  const bridgeCells = 3;
  const innerPadX = Math.max(0.35, projectionZone.width * 0.004);
  const innerPadY = Math.max(0.35, projectionZone.height * 0.006);
  const cells = new Map<string, { gx: number; gy: number; points: Coordinate[]; edgeCount: number }>();

  for (const point of edgePoints) {
    if (point.strength < 62) continue;
    if (point.x < projectionZone.x + innerPadX || point.x > projectionZone.x + projectionZone.width - innerPadX) continue;
    if (point.y < projectionZone.y + innerPadY || point.y > projectionZone.y + projectionZone.height - innerPadY) continue;
    const gx = Math.round((point.x - projectionZone.x) / cellSize);
    const gy = Math.round((point.y - projectionZone.y) / cellSize);
    const key = pointKey(gx, gy);
    const cell = cells.get(key);
    if (cell) {
      cell.points.push({ x: point.x, y: point.y });
      cell.edgeCount += 1;
    } else {
      cells.set(key, { gx, gy, points: [{ x: point.x, y: point.y }], edgeCount: 1 });
    }
  }

  const visited = new Set<string>();
  const components: EdgeOutlineCandidate[] = [];

  for (const [key, first] of cells) {
    if (visited.has(key)) continue;
    const queue = [first];
    visited.add(key);
    const componentPoints: Coordinate[] = [];
    let edgeCount = 0;

    while (queue.length) {
      const cell = queue.pop()!;
      componentPoints.push(...cell.points);
      edgeCount += cell.edgeCount;
      for (let dx = -bridgeCells; dx <= bridgeCells; dx += 1) {
        for (let dy = -bridgeCells; dy <= bridgeCells; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          if (Math.hypot(dx, dy) > bridgeCells) continue;
          const nextKey = pointKey(cell.gx + dx, cell.gy + dy);
          if (visited.has(nextKey)) continue;
          const next = cells.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    if (componentPoints.length < 10 || edgeCount < 10) continue;
    const box = makeBounds(componentPoints);
    const area = box.width * box.height;
    if (box.width < Math.max(4.2, projectionZone.width * 0.055)) continue;
    if (box.height < Math.max(4.0, projectionZone.height * 0.075)) continue;
    if (area < Math.max(22, projectionArea * 0.0045) || area > projectionArea * 0.22) continue;
    components.push({ ...box, points: componentPoints, edgeCount });
  }

  const merged: EdgeOutlineCandidate[] = [];
  for (const candidate of components.sort((a, b) => b.edgeCount - a.edgeCount)) {
    let mergedIndex = -1;
    for (let i = 0; i < merged.length; i += 1) {
      const existing = merged[i];
      const gap = boxGap(existing, candidate);
      const overlap = overlapAmount(existing, candidate);
      const near = gap.x <= Math.max(1.8, projectionZone.width * 0.035) && gap.y <= Math.max(1.8, projectionZone.height * 0.055);
      const overlapping = overlap / Math.max(Math.min(existing.width * existing.height, candidate.width * candidate.height), 1) > 0.04;
      if (!near && !overlapping) continue;
      const combinedPoints = existing.points.concat(candidate.points);
      const combinedBox = makeBounds(combinedPoints);
      const combinedArea = combinedBox.width * combinedBox.height;
      if (combinedArea > projectionArea * 0.24) continue;
      if (combinedBox.width > projectionZone.width * 0.46 || combinedBox.height > projectionZone.height * 0.66) continue;
      merged[i] = { ...combinedBox, points: combinedPoints, edgeCount: existing.edgeCount + candidate.edgeCount };
      mergedIndex = i;
      break;
    }
    if (mergedIndex === -1) merged.push(candidate);
  }

  return merged
    .filter((candidate) => {
      const area = candidate.width * candidate.height;
      const aspect = candidate.width / Math.max(candidate.height, 0.01);
      return candidate.edgeCount >= 14 && area >= projectionArea * 0.005 && area <= projectionArea * 0.22 && aspect >= 0.22 && aspect <= 4.8;
    })
    .sort((a, b) => b.edgeCount - a.edgeCount)
    .slice(0, 10);
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const candidates = buildOutlineCandidatesFromEdges(edgePoints, projectionZone);
  return candidates.map((candidate, index) => {
    const hull = convexHull(candidate.points);
    const outline = expandOutline(simplifyOutline(hull), Math.max(0.45, Math.min(candidate.width, candidate.height) * 0.035), projectionZone);
    const boundingBox = makeBounds(outline);
    return {
      id: \`auto_mask_\${Date.now()}_\${index}\`,
      type: "auto-generated",
      shape: "polygon",
      points: outline,
      boundingBox: {
        x: Number(boundingBox.x.toFixed(2)),
        y: Number(boundingBox.y.toFixed(2)),
        width: Number(boundingBox.width.toFixed(2)),
        height: Number(boundingBox.height.toFixed(2))
      },
      enabled: true
    };
  });
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now use connected edge outlines as filled polygon masks");
