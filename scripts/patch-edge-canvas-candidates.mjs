import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

const edgeFunction = String.raw`
export async function generateAutoMasksFromEdgeCanvas(
  edgeCanvasUrl: string,
  projectionZone: ProjectionZone
): Promise<AutoMaskZone[]> {
  // This reads the exact rendered Edge-only View image. If a cyan edge is visible
  // to the user, this function can see it. It does not read the original photo.
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
  const core = new Uint8Array(total);
  const grown = new Uint8Array(total);
  const strength = new Uint16Array(total);
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
      const isVisibleCyanEdge = a >= 45 && b >= 120 && g >= 95 && r <= 80;
      if (!isVisibleCyanEdge) continue;
      const px = (x / Math.max(canvas.width - 1, 1)) * 100;
      const py = (y / Math.max(canvas.height - 1, 1)) * 100;
      const gx = toGridX(px);
      const gy = toGridY(py);
      if (gx < minGX || gx > maxGX || gy < minGY || gy > maxGY) continue;
      const cell = index(gx, gy);
      core[cell] = 1;
      strength[cell] = Math.max(strength[cell], a + g + b);
    }
  }

  const radius = 2;
  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      if (!core[index(x, y)]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius + 1) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          grown[index(nx, ny)] = 1;
        }
      }
    }
  }

  const overlapAmountLocal = (a: ProjectionZone, b: ProjectionZone) => {
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return xOverlap * yOverlap;
  };

  const projectionArea = projectionZone.width * projectionZone.height;
  const dirs = [1, -1, gridW, -gridW, gridW + 1, gridW - 1, -gridW + 1, -gridW - 1];
  const visited = new Uint8Array(total);
  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];

  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      const start = index(x, y);
      if (!grown[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      let grownCells = 0;
      let edgeCells = 0;
      let strengthSum = 0;

      while (queue.length) {
        const current = queue.pop()!;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        grownCells += 1;
        if (core[current]) {
          edgeCells += 1;
          strengthSum += strength[current];
        }
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        for (const dir of dirs) {
          const next = current + dir;
          if (next < 0 || next >= total || visited[next] || !grown[next]) continue;
          const nx = next % gridW;
          const ny = Math.floor(next / gridW);
          if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (edgeCells < 7 || grownCells < 10) continue;
      const raw = {
        x: toPercentX(x0),
        y: toPercentY(y0),
        width: Math.max(0, toPercentX(x1) - toPercentX(x0)),
        height: Math.max(0, toPercentY(y1) - toPercentY(y0))
      };
      const padX = Math.max(0.75, raw.width * 0.12);
      const padY = Math.max(0.75, raw.height * 0.12);
      const left = clamp(raw.x - padX, projectionZone.x, projectionZone.x + projectionZone.width);
      const top = clamp(raw.y - padY, projectionZone.y, projectionZone.y + projectionZone.height);
      const right = clamp(raw.x + raw.width + padX, projectionZone.x, projectionZone.x + projectionZone.width);
      const bottom = clamp(raw.y + raw.height + padY, projectionZone.y, projectionZone.y + projectionZone.height);
      const box = { x: left, y: top, width: right - left, height: bottom - top };
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      const density = edgeCells / Math.max(grownCells, 1);
      const nearSurfaceEdge =
        box.x <= projectionZone.x + projectionZone.width * 0.012 ||
        box.x + box.width >= projectionZone.x + projectionZone.width * 0.988 ||
        box.y <= projectionZone.y + projectionZone.height * 0.012 ||
        box.y + box.height >= projectionZone.y + projectionZone.height * 0.988;
      const borderLine =
        (box.width > projectionZone.width * 0.42 && box.height < projectionZone.height * 0.12) ||
        (box.height > projectionZone.height * 0.62 && box.width < projectionZone.width * 0.065);

      if (box.width < Math.max(2.4, projectionZone.width * 0.030)) continue;
      if (box.height < Math.max(2.4, projectionZone.height * 0.038)) continue;
      if (area < projectionArea * 0.0012 || area > projectionArea * 0.34) continue;
      if (aspect < 0.10 || aspect > 10) continue;
      if (nearSurfaceEdge && borderLine) continue;
      if (density < 0.11) continue;

      candidates.push({
        box,
        points: [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
          { x: box.x, y: box.y + box.height }
        ],
        score: edgeCells * 3 + density * 90 + strengthSum / Math.max(edgeCells, 1) * 0.06 - area * 0.11 - (nearSurfaceEdge ? 55 : 0)
      });
    }
  }

  const accepted: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmountLocal(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.34;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({
      id: "auto_mask_visible_edge_" + Date.now() + "_" + index,
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

if (!edge.includes("generateAutoMasksFromEdgeCanvas")) {
  const marker = "\nexport function drawProjectionWithMasks(";
  const insert = edge.indexOf(marker);
  if (insert < 0) throw new Error("Could not find drawProjectionWithMasks marker.");
  edge = edge.slice(0, insert) + edgeFunction + edge.slice(insert);
  writeFileSync(edgePath, edge);
}

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
  '      let masks = await generateAutoMasksFromEdgeCanvas(result.edgeCanvasUrl, projectionArea);\n      if (!masks.length) masks = generateAutoMasks(result.edgePoints, projectionArea);'
);
app = app.replace(
  '      setDetectMessage("Reading enclosed shapes from the edge layer...");',
  '      setDetectMessage("Reading the visible Edge-only View layer...");'
);
writeFileSync(appPath, app);

console.log("visible Edge-only View canvas is now the primary mask candidate source");
