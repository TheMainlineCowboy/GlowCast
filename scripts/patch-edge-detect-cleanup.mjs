import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

const start = source.indexOf("export function generateAutoMasks(");
const end = source.indexOf("\nexport function drawProjectionWithMasks(");

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Could not find generateAutoMasks block to replace.");
}

const replacement = `function makeMaskFromBox(box: ProjectionZone, index: number): AutoMaskZone {
  return {
    id: \`auto_mask_\${Date.now()}_\${index}\`,
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
  };
}

function buildLooseEdgeObjectCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  const gridWidth = 160;
  const gridHeight = Math.max(70, Math.round(gridWidth * (projectionZone.height / Math.max(projectionZone.width, 1))));
  const total = gridWidth * gridHeight;
  const grid = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const indexFor = (x: number, y: number) => y * gridWidth + x;
  const projectionArea = projectionZone.width * projectionZone.height;

  const mark = (x: number, y: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const gx = x + dx;
        const gy = y + dy;
        if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) continue;
        grid[indexFor(gx, gy)] = 1;
      }
    }
  };

  for (const point of edgePoints) {
    if (point.strength < 62) continue;
    if (point.x < projectionZone.x || point.x > projectionZone.x + projectionZone.width) continue;
    if (point.y < projectionZone.y || point.y > projectionZone.y + projectionZone.height) continue;
    const nx = (point.x - projectionZone.x) / Math.max(projectionZone.width, 1);
    const ny = (point.y - projectionZone.y) / Math.max(projectionZone.height, 1);
    const gx = Math.max(0, Math.min(gridWidth - 1, Math.round(nx * (gridWidth - 1))));
    const gy = Math.max(0, Math.min(gridHeight - 1, Math.round(ny * (gridHeight - 1))));
    mark(gx, gy, 2);
  }

  const boxes: ComponentBox[] = [];
  const neighbors = [-1, 0, 1];
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const startIdx = indexFor(x, y);
      if (!grid[startIdx] || visited[startIdx]) continue;

      const queue: Array<[number, number]> = [[x, y]];
      visited[startIdx] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let cells = 0;

      while (queue.length) {
        const [cx, cy] = queue.pop()!;
        cells += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const dx of neighbors) {
          for (const dy of neighbors) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
            const idx = indexFor(nx, ny);
            if (!grid[idx] || visited[idx]) continue;
            visited[idx] = 1;
            queue.push([nx, ny]);
          }
        }
      }

      const raw = {
        x: projectionZone.x + (minX / gridWidth) * projectionZone.width,
        y: projectionZone.y + (minY / gridHeight) * projectionZone.height,
        width: ((maxX - minX + 1) / gridWidth) * projectionZone.width,
        height: ((maxY - minY + 1) / gridHeight) * projectionZone.height
      };
      const padX = Math.max(0.45, raw.width * 0.06);
      const padY = Math.max(0.45, raw.height * 0.06);
      const box = clampToProjection(paddedBox(raw, padX, padY), projectionZone);
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);

      if (cells < 24) continue;
      if (box.width < Math.max(4.2, projectionZone.width * 0.055)) continue;
      if (box.height < Math.max(4.2, projectionZone.height * 0.075)) continue;
      if (area < Math.max(18, projectionArea * 0.0035)) continue;
      if (area > projectionArea * 0.22) continue;
      if (aspect < 0.18 || aspect > 5.8) continue;

      boxes.push({ ...box, cells, edgeCount: cells, score: cells + area });
    }
  }

  const accepted: ComponentBox[] = [];
  for (const candidate of boxes.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.42;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }
  return accepted;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const looseCandidates = buildLooseEdgeObjectCandidates(edgePoints, projectionZone).map(makeMaskFromBox);
  if (looseCandidates.length) return looseCandidates;

  const fallbackCandidates = buildWindowCandidates(edgePoints, projectionZone).map(makeMaskFromBox);
  return fallbackCandidates;
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge detector now uses loose connected visible-edge object candidates");
