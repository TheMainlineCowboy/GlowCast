import { readFileSync, writeFileSync } from "node:fs";

const edgeDetect = String.raw`export type EdgePoint = { x: number; y: number; strength: number };
export type Coordinate = { x: number; y: number };

export type EdgeScanResult = {
  edgeCanvasUrl: string;
  edgeRegionCanvasUrl: string;
  edgePoints: EdgePoint[];
};

export type AutoMaskZone = {
  id: string;
  type: "auto-generated";
  shape: "polygon";
  points: Coordinate[];
  boundingBox: { x: number; y: number; width: number; height: number };
  enabled: boolean;
};

type ProjectionZone = { x: number; y: number; width: number; height: number };
type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };
type GridBox = { x0: number; y0: number; x1: number; y1: number };
type HoleComponent = {
  cells: number[];
  box: GridBox;
  area: number;
  fillRatio: number;
  points: Coordinate[];
};

function loadScanImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for edge scanning."));
    image.src = src;
  });
}

export async function scanImageEdges(src: string): Promise<EdgeScanResult> {
  const image = await loadScanImage(src);
  const maxSize = 900;
  const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not start edge scanner canvas.");

  ctx.drawImage(image, 0, 0, width, height);
  const source = ctx.getImageData(0, 0, width, height);
  const data = source.data;
  const gray = new Uint8ClampedArray(width * height);

  for (let i = 0; i < gray.length; i += 1) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }

  const overlay = ctx.createImageData(width, height);
  const out = overlay.data;
  const edgePoints: EdgePoint[] = [];
  const threshold = 58;
  const stride = Math.max(1, Math.round(Math.min(width, height) / 700));

  for (let y = 1; y < height - 1; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] + gray[i - width + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + width - 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
        gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const strength = Math.min(255, Math.round(Math.hypot(gx, gy)));
      if (strength < threshold) continue;
      edgePoints.push({ x: (x / width) * 100, y: (y / height) * 100, strength });
      const p = i * 4;
      out[p] = 0;
      out[p + 1] = 220;
      out[p + 2] = 255;
      out[p + 3] = Math.min(235, Math.max(95, strength));
    }
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);
  ctx.putImageData(overlay, 0, 0);
  const edgeCanvasUrl = canvas.toDataURL("image/png");
  return { edgeCanvasUrl, edgeRegionCanvasUrl: edgeCanvasUrl, edgePoints };
}

export function snapPointToEdge(point: Coordinate, edgePoints: EdgePoint[], maxDistance = 2.2): Coordinate {
  let best: EdgePoint | null = null;
  let bestDistance = maxDistance;
  for (const edge of edgePoints) {
    const distance = Math.hypot(edge.x - point.x, edge.y - point.y);
    if (distance < bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }
  return best ? { x: best.x, y: best.y } : point;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function toPercentBox(box: GridBox, gridW: number, gridH: number): ProjectionZone {
  const x = (box.x0 / gridW) * 100;
  const y = (box.y0 / gridH) * 100;
  const width = ((box.x1 - box.x0 + 1) / gridW) * 100;
  const height = ((box.y1 - box.y0 + 1) / gridH) * 100;
  return { x, y, width, height };
}

function expandBox(box: ProjectionZone, projection: ProjectionZone): ProjectionZone {
  const padX = clamp(box.width * 0.28, 0.65, 2.75);
  const padY = clamp(box.height * 0.28, 0.65, 2.75);
  const x = Math.max(projection.x, box.x - padX);
  const y = Math.max(projection.y, box.y - padY);
  const right = Math.min(projection.x + projection.width, box.x + box.width + padX);
  const bottom = Math.min(projection.y + projection.height, box.y + box.height + padY);
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(Math.max(0.5, right - x).toFixed(2)),
    height: Number(Math.max(0.5, bottom - y).toFixed(2))
  };
}

function overlapAmount(a: ProjectionZone, b: ProjectionZone) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

function mergeBoxes(a: ProjectionZone, b: ProjectionZone): ProjectionZone {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function shouldMerge(a: ProjectionZone, b: ProjectionZone, projection: ProjectionZone) {
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  const overlap = overlapAmount(a, b);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  if (overlap / Math.max(minArea, 0.01) > 0.12) return true;
  const paneGapX = Math.max(0.75, projection.width * 0.028);
  const paneGapY = Math.max(0.75, projection.height * 0.040);
  return gapX <= paneGapX && gapY <= Math.max(paneGapY, Math.max(a.height, b.height) * 0.45);
}

function mergeCloseHoles(boxes: ProjectionZone[], projection: ProjectionZone): ProjectionZone[] {
  const merged = [...boxes];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!shouldMerge(merged[i], merged[j], projection)) continue;
        const combined = mergeBoxes(merged[i], merged[j]);
        const area = combined.width * combined.height;
        if (area > projection.width * projection.height * 0.28) continue;
        merged[i] = combined;
        merged.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return merged;
}

function convexHull(points: Coordinate[]): Coordinate[] {
  const sorted = [...points]
    .map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) }))
    .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const unique = sorted.filter((point, index) => index === 0 || point.x !== sorted[index - 1].x || point.y !== sorted[index - 1].y);
  if (unique.length <= 3) return unique;
  const cross = (o: Coordinate, a: Coordinate, b: Coordinate) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Coordinate[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Coordinate[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function simplifyHull(points: Coordinate[], maxPoints = 18): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const result: Coordinate[] = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) result.push(points[Math.floor(i * step)]);
  return result;
}

function findEnclosedHoles(edgePoints: EdgePoint[], projection: ProjectionZone): HoleComponent[] {
  const gridW = 260;
  const gridH = 260;
  const total = gridW * gridH;
  const wall = new Uint8Array(total);
  const inProjection = new Uint8Array(total);
  const index = (x: number, y: number) => y * gridW + x;

  const minX = Math.max(1, Math.floor((projection.x / 100) * gridW));
  const minY = Math.max(1, Math.floor((projection.y / 100) * gridH));
  const maxX = Math.min(gridW - 2, Math.ceil(((projection.x + projection.width) / 100) * gridW));
  const maxY = Math.min(gridH - 2, Math.ceil(((projection.y + projection.height) / 100) * gridH));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) inProjection[index(x, y)] = 1;
  }

  const strong = edgePoints.filter((point) =>
    point.strength >= 74 &&
    point.x >= projection.x && point.x <= projection.x + projection.width &&
    point.y >= projection.y && point.y <= projection.y + projection.height
  );

  const radius = 2;
  for (const point of strong) {
    const gx = Math.round((point.x / 100) * (gridW - 1));
    const gy = Math.round((point.y / 100) * (gridH - 1));
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius + 1) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) continue;
        wall[index(x, y)] = 1;
      }
    }
  }

  const visited = new Uint8Array(total);
  const queue: number[] = [];
  const pushOpen = (x: number, y: number) => {
    const i = index(x, y);
    if (!inProjection[i] || wall[i] || visited[i]) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let x = minX; x <= maxX; x += 1) {
    pushOpen(x, minY);
    pushOpen(x, maxY);
  }
  for (let y = minY; y <= maxY; y += 1) {
    pushOpen(minX, y);
    pushOpen(maxX, y);
  }

  const directions = [1, -1, gridW, -gridW];
  while (queue.length) {
    const current = queue.pop()!;
    const cx = current % gridW;
    for (const d of directions) {
      const next = current + d;
      const nx = next % gridW;
      if (next < 0 || next >= total) continue;
      if ((d === 1 || d === -1) && Math.abs(nx - cx) !== 1) continue;
      if (!inProjection[next] || wall[next] || visited[next]) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }

  const components: HoleComponent[] = [];
  const seenHole = new Uint8Array(total);

  for (let y = minY + 1; y < maxY; y += 1) {
    for (let x = minX + 1; x < maxX; x += 1) {
      const start = index(x, y);
      if (!inProjection[start] || wall[start] || visited[start] || seenHole[start]) continue;
      const stack = [start];
      seenHole[start] = 1;
      const cells: number[] = [];
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      let touchesProjectionEdge = false;

      while (stack.length) {
        const current = stack.pop()!;
        cells.push(current);
        const cx = current % gridW;
        const cy = Math.floor(current / gridW);
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        if (cx <= minX + 1 || cx >= maxX - 1 || cy <= minY + 1 || cy >= maxY - 1) touchesProjectionEdge = true;

        for (const d of directions) {
          const next = current + d;
          const nx = next % gridW;
          if (next < 0 || next >= total) continue;
          if ((d === 1 || d === -1) && Math.abs(nx - cx) !== 1) continue;
          if (!inProjection[next] || wall[next] || visited[next] || seenHole[next]) continue;
          seenHole[next] = 1;
          stack.push(next);
        }
      }

      if (touchesProjectionEdge) continue;
      const box = { x0, y0, x1, y1 };
      const percentBox = toPercentBox(box, gridW, gridH);
      const projectionArea = projection.width * projection.height;
      const boxArea = percentBox.width * percentBox.height;
      const fillRatio = cells.length / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
      const aspect = percentBox.width / Math.max(percentBox.height, 0.01);

      if (cells.length < 18) continue;
      if (boxArea < projectionArea * 0.0025 || boxArea > projectionArea * 0.22) continue;
      if (percentBox.width < Math.max(2.0, projection.width * 0.035)) continue;
      if (percentBox.height < Math.max(2.0, projection.height * 0.055)) continue;
      if (fillRatio < 0.20) continue;
      if (aspect < 0.16 || aspect > 5.5) continue;

      const boundary: Coordinate[] = [];
      for (const cell of cells) {
        const cx = cell % gridW;
        const cy = Math.floor(cell / gridW);
        const isBoundary = directions.some((d) => {
          const n = cell + d;
          return n < 0 || n >= total || wall[n] || visited[n] || !inProjection[n];
        });
        if (isBoundary) boundary.push({ x: (cx / gridW) * 100, y: (cy / gridH) * 100 });
      }

      components.push({ cells, box, area: boxArea, fillRatio, points: simplifyHull(convexHull(boundary)) });
    }
  }

  return components;
}

function pointsForBox(box: ProjectionZone): Coordinate[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const holes = findEnclosedHoles(edgePoints, projectionZone);
  const holeBoxes = holes.map((hole) => toPercentBox(hole.box, 260, 260));
  const mergedBoxes = mergeCloseHoles(holeBoxes, projectionZone)
    .map((box) => expandBox(box, projectionZone))
    .filter((box) => box.width * box.height >= projectionZone.width * projectionZone.height * 0.006)
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);

  const accepted: ProjectionZone[] = [];
  for (const box of mergedBoxes) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, box);
      const minArea = Math.min(existing.width * existing.height, box.width * box.height);
      return overlap / Math.max(minArea, 0.01) > 0.50;
    });
    if (!duplicate) accepted.push(box);
    if (accepted.length >= 12) break;
  }

  return accepted.map((box, index) => ({
    id: `auto_mask_${Date.now()}_${index}`,
    type: "auto-generated",
    shape: "polygon",
    points: pointsForBox(box),
    boundingBox: box,
    enabled: true
  }));
}

export function drawProjectionWithMasks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  projectionZone: ProjectionZone,
  masks: AutoMaskZone[],
  renderEffectCallback: () => void
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    (projectionZone.x / 100) * width,
    (projectionZone.y / 100) * height,
    (projectionZone.width / 100) * width,
    (projectionZone.height / 100) * height
  );
  ctx.clip();
  for (const mask of masks) {
    if (!mask.enabled || mask.points.length < 3) continue;
    ctx.beginPath();
    ctx.rect(width, 0, -width, height);
    const firstPoint = mask.points[0];
    ctx.moveTo((firstPoint.x / 100) * width, (firstPoint.y / 100) * height);
    for (let i = 1; i < mask.points.length; i += 1) {
      ctx.lineTo((mask.points[i].x / 100) * width, (mask.points[i].y / 100) * height);
    }
    ctx.closePath();
    ctx.clip();
  }
  renderEffectCallback();
  ctx.restore();
}
`;

writeFileSync("src/edgeDetect.ts", edgeDetect);

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

app = app.replace(
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
  'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type AutoMaskZone, type EdgePoint } from "./edgeDetect";'
);

app = app.replace(
  '  const [snapEnabled, setSnapEnabled] = useState(true);',
  '  const [snapEnabled, setSnapEnabled] = useState(true);\n  const [edgeOnlyMode, setEdgeOnlyMode] = useState(false);'
);

app = app.replace(
  '    setSnapEnabled(true);\n  }',
  '    setSnapEnabled(true);\n    setEdgeOnlyMode(false);\n  }'
);

const helperFunctions = String.raw`

  function edgeCandidateZones() {
    return zones.filter((zone) => zone.label === "edge candidate");
  }

  function autoMaskToZone(mask: AutoMaskZone, index: number): ProjectZone {
    const box = mask.boundingBox;
    const relativePoints = mask.points.map((point) => ({
      x: Number(clamp(((point.x - box.x) / Math.max(box.width, 0.01)) * 100).toFixed(2)),
      y: Number(clamp(((point.y - box.y) / Math.max(box.height, 0.01)) * 100).toFixed(2))
    }));
    return {
      id: Date.now() + index,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      included: false,
      label: "edge candidate",
      shape: "freehand",
      points: relativePoints.length >= 3 ? relativePoints : undefined
    };
  }

  async function ensureEdgeScan() {
    if (!imageUrl) return null;
    if (edgePoints.length && edgeOverlayUrl) return { edgePoints, edgeCanvasUrl: edgeOverlayUrl };
    setEdgeScanning(true);
    const result = await scanImageEdges(imageUrl);
    setEdgeOverlayUrl(result.edgeCanvasUrl);
    setEdgePoints(result.edgePoints);
    setShowEdges(true);
    setEdgeScanning(false);
    return result;
  }

  async function createEdgeMaskCandidates() {
    if (!projectionArea || !imageUrl) {
      setDetectMessage("Draw the projection surface first, then create edge masks.");
      return;
    }
    try {
      setDetectMessage("Reading closed shapes from the edge layer...");
      const result = await ensureEdgeScan();
      if (!result) return;
      const masks = generateAutoMasks(result.edgePoints, projectionArea);
      const nextCandidates = masks.map(autoMaskToZone);
      setZones((current) => [
        ...current.filter((zone) => zone.label !== "edge candidate"),
        ...nextCandidates
      ]);
      if (nextCandidates.length) {
        setSelectedTarget("zone");
        setSelectedZoneId(nextCandidates[0].id);
        setDetectMessage(`Filled ${nextCandidates.length} closed edge outline${nextCandidates.length === 1 ? "" : "s"} into selectable mask candidates.`);
      } else {
        setSelectedTarget("surface");
        setSelectedZoneId(null);
        setDetectMessage("No fully enclosed edge shapes found. Use Edge-only View to confirm the shape is closed, or draw a mask and use magnetic snap.");
      }
    } catch (error) {
      setDebugWarnings([error instanceof Error ? error.message : "Edge mask creation failed."]);
      setDetectMessage("Edge mask creation failed. You can still draw masks manually with magnetic snap.");
      setEdgeScanning(false);
    }
  }

  function applySelectedEdgeCandidate() {
    if (!selectedZoneId) {
      setDetectMessage("Select an edge candidate first.");
      return;
    }
    setZones((current) => current.map((zone) => zone.id === selectedZoneId ? { ...zone, included: true, label: "approved edge mask" } : zone));
    setDetectMessage("Applied selected edge candidate as a real mask.");
  }

  function applyAllEdgeCandidates() {
    const candidates = edgeCandidateZones();
    if (!candidates.length) {
      setDetectMessage("No edge candidates to apply.");
      return;
    }
    setZones((current) => current.map((zone) => zone.label === "edge candidate" ? { ...zone, included: true, label: "approved edge mask" } : zone));
    setDetectMessage(`Applied ${candidates.length} edge candidate${candidates.length === 1 ? "" : "s"} as real masks.`);
  }

  function clearEdgeCandidates() {
    setZones((current) => current.filter((zone) => zone.label !== "edge candidate"));
    setSelectedTarget("surface");
    setSelectedZoneId(null);
    setDetectMessage("Cleared edge candidates.");
  }

  async function toggleEdgeOnlyMode() {
    if (!imageUrl) return;
    if (edgeOnlyMode) {
      setEdgeOnlyMode(false);
      return;
    }
    try {
      await ensureEdgeScan();
      setEdgeOnlyMode(true);
      setShowEdges(true);
      setProjectionOnly(false);
      setDetectMessage("Showing only the scanned edge layer.");
    } catch (error) {
      setDebugWarnings([error instanceof Error ? error.message : "Edge-only view failed."]);
      setDetectMessage("Edge-only view failed.");
      setEdgeScanning(false);
    }
  }
`;

if (!app.includes("function createEdgeMaskCandidates()")) {
  app = app.replace("\n  function resetForPhoto", `${helperFunctions}\n  function resetForPhoto`);
}

app = app.replace(
  '          {imageUrl && (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          )}',
  '          {edgeOnlyMode && edgeOverlayUrl ? (\n            <img className="referencePhoto edgeOnlyStage" src={edgeOverlayUrl} alt="Scanned edge layer" draggable={false} />\n          ) : imageUrl ? (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          ) : null}'
);
app = app.replace(
  '          {showEdges && edgeOverlayUrl && !projectionOnly ? (',
  '          {showEdges && edgeOverlayUrl && !projectionOnly && !edgeOnlyMode ? ('
);
app = app.replaceAll('!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map', '!projectionOnly && !edgeOnlyMode && !cornerMode && !surfacePolygonMode && zones.map');
app = app.replaceAll('invertMode && projectionArea && !surfacePolygonClosed && (', 'invertMode && projectionArea && !edgeOnlyMode && !surfacePolygonClosed && (');
app = app.replaceAll('surfacePolygonClosed ? renderPolygonProjectionLayer() : null', 'surfacePolygonClosed && !edgeOnlyMode ? renderPolygonProjectionLayer() : null');
app = app.replaceAll('projectionArea && showSurfaceHandles && !projectionOnly', 'projectionArea && showSurfaceHandles && !projectionOnly && !edgeOnlyMode');
app = app.replaceAll('draftRect && !projectionOnly', 'draftRect && !projectionOnly && !edgeOnlyMode');

const edgeButtons = String.raw`
              <button type="button" onClick={toggleEdgeOnlyMode} disabled={!imageUrl || edgeScanning}>
                {edgeOnlyMode ? "Show Photo View" : "Edge-only View"}
              </button>
              <button type="button" onClick={createEdgeMaskCandidates} disabled={!imageUrl || !projectionArea || edgeScanning}>
                Create Edge Mask Candidates
              </button>
              <button className="primary" onClick={applySelectedEdgeCandidate} disabled={selectedZone?.label !== "edge candidate"}>
                Apply Selected Candidate
              </button>
              <button type="button" onClick={applyAllEdgeCandidates} disabled={!edgeCandidateZones().length}>
                Apply All Candidates
              </button>
              <button type="button" onClick={clearEdgeCandidates} disabled={!edgeCandidateZones().length}>
                Clear Candidates
              </button>`;

if (!app.includes("Create Edge Mask Candidates")) {
  app = app.replace(
    '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>',
    `${edgeButtons}\n              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>`
  );
}

app = app.replace(
  '      ctx.strokeRect(x, y, width, height);',
  '      if (zone.points && zone.points.length >= 3) {\n        ctx.beginPath();\n        zone.points.forEach((point, pointIndex) => {\n          const px = x + (point.x / 100) * width;\n          const py = y + (point.y / 100) * height;\n          if (pointIndex === 0) ctx.moveTo(px, py);\n          else ctx.lineTo(px, py);\n        });\n        ctx.closePath();\n        ctx.stroke();\n      } else {\n        ctx.strokeRect(x, y, width, height);\n      }'
);

app = app.replace(
  '              {zone.shape === "freehand" ? (\n                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">\n                  <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />\n                </svg>\n              ) : null}',
  '              {zone.shape === "freehand" ? (\n                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">\n                  {zone.points && zone.points.length >= 3 ? (\n                    <polygon points={zone.points.map((point) => `${point.x},${point.y}`).join(" ")} />\n                  ) : (\n                    <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />\n                  )}\n                </svg>\n              ) : null}'
);

writeFileSync(appPath, app);
console.log("stable flood-fill edge mask pipeline installed");
