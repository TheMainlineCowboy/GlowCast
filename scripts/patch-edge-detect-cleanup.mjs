import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("export function generateAutoMasks(");
const end = source.indexOf("\nexport function drawProjectionWithMasks(");

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Could not find generateAutoMasks block to replace.");
}

const replacement = `function convexHull(points: Coordinate[]): Coordinate[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (origin: Coordinate, a: Coordinate, b: Coordinate) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Coordinate[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Coordinate[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function simplifyPolygon(points: Coordinate[], maxPoints = 14): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const simplified: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    simplified.push(points[Math.min(points.length - 1, Math.floor(i * step))]);
  }
  return simplified;
}

function boundsForPoints(points: Coordinate[]): ProjectionZone {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x, y, width: maxX - x, height: maxY - y };
}

function buildEnclosedEdgeCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): AutoMaskZone[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  const gridWidth = 190;
  const gridHeight = Math.max(90, Math.round(gridWidth * (projectionZone.height / Math.max(projectionZone.width, 1))));
  const total = gridWidth * gridHeight;
  const edge = new Uint8Array(total);
  const outside = new Uint8Array(total);
  const interiorVisited = new Uint8Array(total);
  const indexFor = (x: number, y: number) => y * gridWidth + x;

  const insideProjection = (point: EdgePoint) =>
    point.x >= projectionZone.x &&
    point.x <= projectionZone.x + projectionZone.width &&
    point.y >= projectionZone.y &&
    point.y <= projectionZone.y + projectionZone.height;

  const drawEdgeCell = (gx: number, gy: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue;
        edge[indexFor(x, y)] = 1;
      }
    }
  };

  for (const point of edgePoints) {
    if (!insideProjection(point) || point.strength < 70) continue;
    const nx = (point.x - projectionZone.x) / Math.max(projectionZone.width, 1);
    const ny = (point.y - projectionZone.y) / Math.max(projectionZone.height, 1);
    const gx = Math.max(0, Math.min(gridWidth - 1, Math.round(nx * (gridWidth - 1))));
    const gy = Math.max(0, Math.min(gridHeight - 1, Math.round(ny * (gridHeight - 1))));
    drawEdgeCell(gx, gy, 2);
  }

  const queue: Array<[number, number]> = [];
  const pushOutside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return;
    const idx = indexFor(x, y);
    if (outside[idx] || edge[idx]) return;
    outside[idx] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < gridWidth; x += 1) {
    pushOutside(x, 0);
    pushOutside(x, gridHeight - 1);
  }
  for (let y = 0; y < gridHeight; y += 1) {
    pushOutside(0, y);
    pushOutside(gridWidth - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.shift()!;
    pushOutside(x + 1, y);
    pushOutside(x - 1, y);
    pushOutside(x, y + 1);
    pushOutside(x, y - 1);
  }

  const candidates: Array<AutoMaskZone & { score: number }> = [];
  const cellToPoint = (x: number, y: number): Coordinate => ({
    x: projectionZone.x + ((x + 0.5) / gridWidth) * projectionZone.width,
    y: projectionZone.y + ((y + 0.5) / gridHeight) * projectionZone.height
  });

  for (let y = 1; y < gridHeight - 1; y += 1) {
    for (let x = 1; x < gridWidth - 1; x += 1) {
      const startIdx = indexFor(x, y);
      if (edge[startIdx] || outside[startIdx] || interiorVisited[startIdx]) continue;

      const component: Array<[number, number]> = [];
      const componentQueue: Array<[number, number]> = [[x, y]];
      interiorVisited[startIdx] = 1;

      while (componentQueue.length) {
        const [cx, cy] = componentQueue.pop()!;
        component.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx <= 0 || ny <= 0 || nx >= gridWidth - 1 || ny >= gridHeight - 1) continue;
          const idx = indexFor(nx, ny);
          if (edge[idx] || outside[idx] || interiorVisited[idx]) continue;
          interiorVisited[idx] = 1;
          componentQueue.push([nx, ny]);
        }
      }

      if (component.length < 18) continue;
      const outlineCells: Coordinate[] = [];
      let minX = gridWidth;
      let minY = gridHeight;
      let maxX = 0;
      let maxY = 0;
      for (const [cx, cy] of component) {
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);
        const touchesEdge =
          edge[indexFor(cx + 1, cy)] ||
          edge[indexFor(cx - 1, cy)] ||
          edge[indexFor(cx, cy + 1)] ||
          edge[indexFor(cx, cy - 1)];
        if (touchesEdge) outlineCells.push(cellToPoint(cx, cy));
      }

      if (outlineCells.length < 8) continue;
      const box = boundsForPoints([cellToPoint(minX, minY), cellToPoint(maxX, maxY)]);
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      if (area < projectionArea * 0.004 || area > projectionArea * 0.32) continue;
      if (aspect < 0.12 || aspect > 7) continue;
      if (box.width < 1.6 || box.height < 1.6) continue;

      const hull = simplifyPolygon(convexHull(outlineCells), 16);
      if (hull.length < 3) continue;
      candidates.push({
        id: \`auto_mask_\${Date.now()}_\${candidates.length}\`,
        type: "auto-generated",
        shape: "polygon",
        points: hull,
        boundingBox: {
          x: Number(box.x.toFixed(2)),
          y: Number(box.y.toFixed(2)),
          width: Number(box.width.toFixed(2)),
          height: Number(box.height.toFixed(2))
        },
        enabled: true,
        score: outlineCells.length + area * 2
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, list) => {
      const duplicateIndex = list.findIndex((other) => {
        if (other === candidate) return false;
        const overlap = overlapAmount(other.boundingBox, candidate.boundingBox);
        const minArea = Math.min(other.boundingBox.width * other.boundingBox.height, candidate.boundingBox.width * candidate.boundingBox.height);
        return overlap / Math.max(minArea, 1) > 0.55;
      });
      return duplicateIndex === -1 || duplicateIndex > index;
    })
    .slice(0, 10)
    .map(({ score, ...candidate }) => candidate);
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const enclosedCandidates = buildEnclosedEdgeCandidates(edgePoints, projectionZone);
  if (enclosedCandidates.length) return enclosedCandidates;
  const fallbackCandidates = buildWindowCandidates(edgePoints, projectionZone);
  return fallbackCandidates.map((box, index) => ({
    id: \`auto_mask_\${Date.now()}_fallback_\${index}\`,
    type: "auto-generated",
    shape: "polygon",
    points: rectPoints(box),
    boundingBox: {
      x: Number(box.x.toFixed(2)),
      y: Number(box.y.toFixed(2)),
      width: Number(box.width.toFixed(2)),
      height: Number(box.height.toFixed(2))
    },
    enabled: true
  }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge detector now generates candidates from enclosed edge contours");
