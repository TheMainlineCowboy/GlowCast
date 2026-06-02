import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

const edgeFunction = String.raw`
export async function generateAutoMasksFromEdgeCanvas(
  edgeCanvasUrl: string,
  projectionZone: ProjectionZone
): Promise<AutoMaskZone[]> {
  // Reads the actual Edge-only View image and treats cyan edge lines as walls.
  // Then it flood-fills the projection surface. Any empty area that cannot reach
  // the outside border is a truly enclosed mask candidate.
  const image = await loadScanImage(edgeCanvasUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const gridW = 260;
  const gridH = 260;
  const total = gridW * gridH;
  const wall = new Uint8Array(total);
  const solid = new Uint8Array(total);
  const outside = new Uint8Array(total);
  const index = (x: number, y: number) => y * gridW + x;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const toGridX = (xPercent: number) => clamp(Math.round((xPercent / 100) * (gridW - 1)), 0, gridW - 1);
  const toGridY = (yPercent: number) => clamp(Math.round((yPercent / 100) * (gridH - 1)), 0, gridH - 1);
  const toPercentX = (x: number) => (x / (gridW - 1)) * 100;
  const toPercentY = (y: number) => (y / (gridH - 1)) * 100;
  const minGX = toGridX(projectionZone.x + projectionZone.width * 0.018);
  const maxGX = toGridX(projectionZone.x + projectionZone.width * 0.982);
  const minGY = toGridY(projectionZone.y + projectionZone.height * 0.025);
  const maxGY = toGridY(projectionZone.y + projectionZone.height * 0.955);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const p = (y * canvas.width + x) * 4;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      const a = pixels[p + 3];
      const isVisibleCyanEdge = a >= 35 && b >= 105 && g >= 80 && r <= 95 && b > r + 35 && g > r + 20;
      if (!isVisibleCyanEdge) continue;
      const px = (x / Math.max(canvas.width - 1, 1)) * 100;
      const py = (y / Math.max(canvas.height - 1, 1)) * 100;
      const gx = toGridX(px);
      const gy = toGridY(py);
      if (gx < minGX || gx > maxGX || gy < minGY || gy > maxGY) continue;
      wall[index(gx, gy)] = 1;
    }
  }

  // Thicken the visible edge lines so tiny gaps in Canny/Sobel output close.
  const radius = 3;
  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      if (!wall[index(x, y)]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius + 2) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          solid[index(nx, ny)] = 1;
        }
      }
    }
  }

  // Treat the projection surface boundary as the outside opening.
  const queue: number[] = [];
  const pushOutside = (x: number, y: number) => {
    const cell = index(x, y);
    if (outside[cell] || solid[cell]) return;
    outside[cell] = 1;
    queue.push(cell);
  };
  for (let x = minGX; x <= maxGX; x += 1) {
    pushOutside(x, minGY);
    pushOutside(x, maxGY);
  }
  for (let y = minGY; y <= maxGY; y += 1) {
    pushOutside(minGX, y);
    pushOutside(maxGX, y);
  }

  while (queue.length) {
    const current = queue.pop()!;
    const cx = current % gridW;
    const cy = Math.floor(current / gridW);
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
      const next = index(nx, ny);
      if (outside[next] || solid[next]) continue;
      outside[next] = 1;
      queue.push(next);
    }
  }

  const visited = new Uint8Array(total);
  const projectionArea = projectionZone.width * projectionZone.height;
  const holes: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];

  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      const start = index(x, y);
      if (solid[start] || outside[start] || visited[start]) continue;
      const component = [start];
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let cells = 0;
      let touchingWall = 0;

      while (component.length) {
        const current = component.pop()!;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        cells += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
          [cx + 1, cy + 1], [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          const next = index(nx, ny);
          if (solid[next]) {
            touchingWall += 1;
            continue;
          }
          if (outside[next] || visited[next]) continue;
          visited[next] = 1;
          component.push(next);
        }
      }

      const left = toPercentX(minX);
      const top = toPercentY(minY);
      const right = toPercentX(maxX);
      const bottom = toPercentY(maxY);
      const raw = { x: left, y: top, width: right - left, height: bottom - top };
      const padX = Math.max(0.15, raw.width * 0.02);
      const padY = Math.max(0.15, raw.height * 0.02);
      const box = {
        x: clamp(raw.x - padX, projectionZone.x, projectionZone.x + projectionZone.width),
        y: clamp(raw.y - padY, projectionZone.y, projectionZone.y + projectionZone.height),
        width: clamp(raw.width + padX * 2, 0, projectionZone.width),
        height: clamp(raw.height + padY * 2, 0, projectionZone.height)
      };
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      const touchesSurfaceEdge =
        box.x <= projectionZone.x + projectionZone.width * 0.018 ||
        box.x + box.width >= projectionZone.x + projectionZone.width * 0.982 ||
        box.y <= projectionZone.y + projectionZone.height * 0.025 ||
        box.y + box.height >= projectionZone.y + projectionZone.height * 0.955;

      if (cells < 18) continue;
      if (touchesSurfaceEdge) continue;
      if (box.width < projectionZone.width * 0.035 || box.height < projectionZone.height * 0.050) continue;
      if (area < projectionArea * 0.002 || area > projectionArea * 0.32) continue;
      if (aspect < 0.12 || aspect > 8.5) continue;
      if (touchingWall < Math.max(8, cells * 0.10)) continue;

      holes.push({
        box,
        points: [
          { x: Number(box.x.toFixed(2)), y: Number(box.y.toFixed(2)) },
          { x: Number((box.x + box.width).toFixed(2)), y: Number(box.y.toFixed(2)) },
          { x: Number((box.x + box.width).toFixed(2)), y: Number((box.y + box.height).toFixed(2)) },
          { x: Number(box.x.toFixed(2)), y: Number((box.y + box.height).toFixed(2)) }
        ],
        score: touchingWall * 2 + cells * 0.18 - area * 0.08
      });
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const candidate of holes.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const xOverlap = Math.max(0, Math.min(existing.box.x + existing.box.width, candidate.box.x + candidate.box.width) - Math.max(existing.box.x, candidate.box.x));
      const yOverlap = Math.max(0, Math.min(existing.box.y + existing.box.height, candidate.box.y + candidate.box.height) - Math.max(existing.box.y, candidate.box.y));
      const overlap = xOverlap * yOverlap;
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.40;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 10) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({
      id: "auto_mask_visible_edge_hole_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points,
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

const oldFunction = /\nexport async function generateAutoMasksFromEdgeCanvas\([\s\S]*?\n\}\n\s*export function drawProjectionWithMasks\(/;
if (oldFunction.test(edge)) {
  edge = edge.replace(oldFunction, "\n" + edgeFunction + "\nexport function drawProjectionWithMasks(");
} else if (!edge.includes("generateAutoMasksFromEdgeCanvas")) {
  const marker = "\nexport function drawProjectionWithMasks(";
  const insert = edge.indexOf(marker);
  if (insert < 0) throw new Error("Could not find drawProjectionWithMasks marker.");
  edge = edge.slice(0, insert) + edgeFunction + edge.slice(insert);
}
writeFileSync(edgePath, edge);

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");
app = app.replace(
  'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type AutoMaskZone, type EdgePoint } from "./edgeDetect";',
  'import { generateAutoMasks, generateAutoMasksFromEdgeCanvas, scanImageEdges, snapPointToEdge, type AutoMaskZone, type EdgePoint } from "./edgeDetect";'
);
app = app.replace(
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
  'import { generateAutoMasks, generateAutoMasksFromEdgeCanvas, scanImageEdges, snapPointToEdge, type AutoMaskZone, type EdgePoint } from "./edgeDetect";'
);
app = app.replace(
  '      const masks = generateAutoMasks(result.edgePoints, projectionArea);',
  '      const masks = await generateAutoMasksFromEdgeCanvas(result.edgeCanvasUrl, projectionArea);'
);
app = app.replace(
  '      let masks = await generateAutoMasksFromEdgeCanvas(result.edgeCanvasUrl, projectionArea);\n      if (!masks.length) masks = generateAutoMasks(result.edgePoints, projectionArea);',
  '      const masks = await generateAutoMasksFromEdgeCanvas(result.edgeCanvasUrl, projectionArea);'
);
app = app.replace(
  '      setDetectMessage("Reading enclosed shapes from the edge layer...");',
  '      setDetectMessage("Reading visible edge layer with flood fill...");'
);
app = app.replace(
  '      setDetectMessage("Reading the visible Edge-only View layer...");',
  '      setDetectMessage("Reading visible edge layer with flood fill...");'
);
writeFileSync(appPath, app);

console.log("visible edge canvas flood-fill detector installed; old fallback disabled");
