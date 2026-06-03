import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

const edgeFunction = String.raw`
export async function generateAutoMasksFromEdgeCanvas(
  edgeCanvasUrl: string,
  projectionZone: ProjectionZone
): Promise<AutoMaskZone[]> {
  // Use the same cyan Edge-only View layer the user can visually inspect.
  // The old flood-fill approach searched for enclosed empty holes, which made it
  // choose random wall/texture pockets. This version groups the visible strong
  // outline pixels themselves, then turns each strong outline group into a mask.
  const image = await loadScanImage(edgeCanvasUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const gridW = 320;
  const gridH = 320;
  const total = gridW * gridH;
  const edgeGrid = new Uint8Array(total);
  const solid = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const index = (x: number, y: number) => y * gridW + x;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const toGridX = (xPercent: number) => clamp(Math.round((xPercent / 100) * (gridW - 1)), 0, gridW - 1);
  const toGridY = (yPercent: number) => clamp(Math.round((yPercent / 100) * (gridH - 1)), 0, gridH - 1);
  const toPercentX = (x: number) => (x / (gridW - 1)) * 100;
  const toPercentY = (y: number) => (y / (gridH - 1)) * 100;

  const minGX = toGridX(projectionZone.x + projectionZone.width * 0.012);
  const maxGX = toGridX(projectionZone.x + projectionZone.width * 0.988);
  const minGY = toGridY(projectionZone.y + projectionZone.height * 0.018);
  const maxGY = toGridY(projectionZone.y + projectionZone.height * 0.972);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const p = (y * canvas.width + x) * 4;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      const a = pixels[p + 3];
      const strongCyan = a >= 42 && b >= 115 && g >= 82 && r <= 105 && b > r + 28 && g > r + 12;
      if (!strongCyan) continue;
      const px = (x / Math.max(canvas.width - 1, 1)) * 100;
      const py = (y / Math.max(canvas.height - 1, 1)) * 100;
      const gx = toGridX(px);
      const gy = toGridY(py);
      if (gx < minGX || gx > maxGX || gy < minGY || gy > maxGY) continue;
      edgeGrid[index(gx, gy)] = 1;
    }
  }

  // Slightly thicken the strong outline pixels. This closes small breaks in
  // windows/doors without turning weak wall texture into filled mask holes.
  const dilateRadius = 2;
  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      if (!edgeGrid[index(x, y)]) continue;
      for (let dy = -dilateRadius; dy <= dilateRadius; dy += 1) {
        for (let dx = -dilateRadius; dx <= dilateRadius; dx += 1) {
          if (dx * dx + dy * dy > dilateRadius * dilateRadius + 1) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
          solid[index(nx, ny)] = 1;
        }
      }
    }
  }

  type Candidate = { box: ProjectionZone; edgeCount: number; cells: number; score: number };
  const rawCandidates: Candidate[] = [];
  const projectionArea = projectionZone.width * projectionZone.height;

  for (let y = minGY; y <= maxGY; y += 1) {
    for (let x = minGX; x <= maxGX; x += 1) {
      const start = index(x, y);
      if (!solid[start] || visited[start]) continue;

      const stack = [start];
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let cells = 0;
      let edgeCount = 0;

      while (stack.length) {
        const current = stack.pop()!;
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        cells += 1;
        if (edgeGrid[current]) edgeCount += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < minGX || nx > maxGX || ny < minGY || ny > maxGY) continue;
            const next = index(nx, ny);
            if (!solid[next] || visited[next]) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
      }

      const rawLeft = toPercentX(minX);
      const rawTop = toPercentY(minY);
      const rawRight = toPercentX(maxX);
      const rawBottom = toPercentY(maxY);
      const rawWidth = rawRight - rawLeft;
      const rawHeight = rawBottom - rawTop;
      const padX = Math.max(0.45, rawWidth * 0.18);
      const padY = Math.max(0.45, rawHeight * 0.18);
      const x1 = clamp(rawLeft - padX, projectionZone.x, projectionZone.x + projectionZone.width);
      const y1 = clamp(rawTop - padY, projectionZone.y, projectionZone.y + projectionZone.height);
      const x2 = clamp(rawRight + padX, projectionZone.x, projectionZone.x + projectionZone.width);
      const y2 = clamp(rawBottom + padY, projectionZone.y, projectionZone.y + projectionZone.height);
      const box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      const touchesSurfaceEdge =
        box.x <= projectionZone.x + projectionZone.width * 0.018 ||
        box.x + box.width >= projectionZone.x + projectionZone.width * 0.982 ||
        box.y <= projectionZone.y + projectionZone.height * 0.025 ||
        box.y + box.height >= projectionZone.y + projectionZone.height * 0.970;

      if (edgeCount < 10) continue;
      if (cells < 16) continue;
      if (touchesSurfaceEdge) continue;
      if (box.width < projectionZone.width * 0.030 || box.height < projectionZone.height * 0.040) continue;
      if (area < projectionArea * 0.0016 || area > projectionArea * 0.30) continue;
      if (aspect < 0.18 || aspect > 5.8) continue;

      rawCandidates.push({
        box,
        edgeCount,
        cells,
        score: edgeCount * 2.5 + cells * 0.18 + area * 0.08
      });
    }
  }

  const overlapRatio = (a: ProjectionZone, b: ProjectionZone) => {
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlap = xOverlap * yOverlap;
    const minArea = Math.min(a.width * a.height, b.width * b.height);
    return overlap / Math.max(minArea, 0.01);
  };
  const shouldMerge = (a: ProjectionZone, b: ProjectionZone) => {
    if (overlapRatio(a, b) > 0.08) return true;
    const horizontalGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
    const verticalGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const verticalOverlapRatio = yOverlap / Math.max(Math.min(a.height, b.height), 0.01);
    const horizontalOverlapRatio = xOverlap / Math.max(Math.min(a.width, b.width), 0.01);
    return (
      (horizontalGap <= projectionZone.width * 0.025 && verticalOverlapRatio > 0.35) ||
      (verticalGap <= projectionZone.height * 0.030 && horizontalOverlapRatio > 0.35)
    );
  };
  const unionBox = (a: ProjectionZone, b: ProjectionZone): ProjectionZone => {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.width, b.x + b.width);
    const y2 = Math.max(a.y + a.height, b.y + b.height);
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  };

  let merged = rawCandidates.slice().sort((a, b) => b.score - a.score);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!shouldMerge(merged[i].box, merged[j].box)) continue;
        const box = unionBox(merged[i].box, merged[j].box);
        const area = box.width * box.height;
        if (area > projectionArea * 0.32) continue;
        merged[i] = {
          box,
          edgeCount: merged[i].edgeCount + merged[j].edgeCount,
          cells: merged[i].cells + merged[j].cells,
          score: merged[i].score + merged[j].score
        };
        merged.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }

  const accepted: Candidate[] = [];
  for (const candidate of merged.sort((a, b) => b.score - a.score)) {
    const box = candidate.box;
    const area = box.width * box.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    if (area < projectionArea * 0.002 || area > projectionArea * 0.32) continue;
    if (aspect < 0.16 || aspect > 6.2) continue;
    if (accepted.some((existing) => overlapRatio(existing.box, box) > 0.45)) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box }, candidateIndex) => ({
      id: "auto_mask_edge_component_" + Date.now() + "_" + candidateIndex,
      type: "auto-generated",
      shape: "polygon",
      points: [
        { x: Number(box.x.toFixed(2)), y: Number(box.y.toFixed(2)) },
        { x: Number((box.x + box.width).toFixed(2)), y: Number(box.y.toFixed(2)) },
        { x: Number((box.x + box.width).toFixed(2)), y: Number((box.y + box.height).toFixed(2)) },
        { x: Number(box.x.toFixed(2)), y: Number((box.y + box.height).toFixed(2)) }
      ],
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
  '      setDetectMessage("Grouping visible edge outlines...");'
);
app = app.replace(
  '      setDetectMessage("Reading the visible Edge-only View layer...");',
  '      setDetectMessage("Grouping visible edge outlines...");'
);
app = app.replace(
  '      setDetectMessage("Reading visible edge layer with flood fill...");',
  '      setDetectMessage("Grouping visible edge outlines...");'
);
writeFileSync(appPath, app);

console.log("connected visible edge outline detector installed");
