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
  for (let i = 0; i < maxPoints; i += 1) simplified.push(points[Math.floor(i * step)]);
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

function isMostlyProjectionBorder(box: ProjectionZone, projectionZone: ProjectionZone) {
  const touchesLeft = Math.abs(box.x - projectionZone.x) < 0.9;
  const touchesRight = Math.abs(box.x + box.width - (projectionZone.x + projectionZone.width)) < 0.9;
  const touchesTop = Math.abs(box.y - projectionZone.y) < 0.9;
  const touchesBottom = Math.abs(box.y + box.height - (projectionZone.y + projectionZone.height)) < 0.9;
  const edgeTouches = [touchesLeft, touchesRight, touchesTop, touchesBottom].filter(Boolean).length;
  return edgeTouches >= 2 && (box.width > projectionZone.width * 0.65 || box.height > projectionZone.height * 0.65);
}

function buildOutlineCandidatesFromEdges(edgePoints: EdgePoint[], projectionZone: ProjectionZone): EdgeOutlineCandidate[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  const cellSize = Math.max(0.22, Math.min(projectionZone.width, projectionZone.height) / 145);
  const bridgeCells = 4;
  const innerPadX = Math.max(0.18, projectionZone.width * 0.002);
  const innerPadY = Math.max(0.18, projectionZone.height * 0.003);
  const cells = new Map<string, { gx: number; gy: number; points: Coordinate[]; edgeCount: number }>();

  for (const point of edgePoints) {
    if (point.strength < 48) continue;
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

    if (componentPoints.length < 6 || edgeCount < 6) continue;
    const box = makeBounds(componentPoints);
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    if (isMostlyProjectionBorder(box, projectionZone)) continue;
    if (box.width < Math.max(2.8, projectionZone.width * 0.032)) continue;
    if (box.height < Math.max(2.8, projectionZone.height * 0.045)) continue;
    if (area < Math.max(9, projectionArea * 0.0016) || area > projectionArea * 0.20) continue;
    if (aspect < 0.16 || aspect > 6.5) continue;
    components.push({ ...box, points: componentPoints, edgeCount });
  }

  const merged: EdgeOutlineCandidate[] = [];
  for (const candidate of components.sort((a, b) => b.edgeCount - a.edgeCount)) {
    let didMerge = false;
    for (let i = 0; i < merged.length; i += 1) {
      const existing = merged[i];
      const gap = boxGap(existing, candidate);
      const overlap = overlapAmount(existing, candidate);
      const near = gap.x <= Math.max(1.1, projectionZone.width * 0.022) && gap.y <= Math.max(1.1, projectionZone.height * 0.035);
      const overlapping = overlap / Math.max(Math.min(existing.width * existing.height, candidate.width * candidate.height), 1) > 0.02;
      if (!near && !overlapping) continue;
      const combinedPoints = existing.points.concat(candidate.points);
      const combinedBox = makeBounds(combinedPoints);
      const combinedArea = combinedBox.width * combinedBox.height;
      if (isMostlyProjectionBorder(combinedBox, projectionZone)) continue;
      if (combinedArea > projectionArea * 0.22) continue;
      if (combinedBox.width > projectionZone.width * 0.55 || combinedBox.height > projectionZone.height * 0.72) continue;
      merged[i] = { ...combinedBox, points: combinedPoints, edgeCount: existing.edgeCount + candidate.edgeCount };
      didMerge = true;
      break;
    }
    if (!didMerge) merged.push(candidate);
  }

  const accepted: EdgeOutlineCandidate[] = [];
  for (const candidate of merged.sort((a, b) => b.edgeCount - a.edgeCount)) {
    const area = candidate.width * candidate.height;
    const aspect = candidate.width / Math.max(candidate.height, 0.01);
    if (candidate.edgeCount < 7 || area < projectionArea * 0.0018 || area > projectionArea * 0.22 || aspect < 0.16 || aspect > 6.5) continue;
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.34;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 10) break;
  }

  return accepted;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const candidates = buildOutlineCandidatesFromEdges(edgePoints, projectionZone);
  return candidates.map((candidate, index) => {
    const hull = convexHull(candidate.points);
    const outline = expandOutline(simplifyOutline(hull), Math.max(0.28, Math.min(candidate.width, candidate.height) * 0.025), projectionZone);
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
console.log("edge masks now use connected edge outlines as filled polygon masks with relaxed detection");
