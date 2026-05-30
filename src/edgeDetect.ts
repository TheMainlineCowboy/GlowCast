export type EdgePoint = { x: number; y: number; strength: number };
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
type ComponentBox = ProjectionZone & { score: number; edgeCount: number; cells: number };

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
  const stride = Math.max(1, Math.round(Math.min(width, height) / 450));

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
      out[p + 3] = Math.min(230, Math.max(90, strength));
    }
  }

  ctx.clearRect(0, 0, width, height);
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

function rectPoints(box: ProjectionZone): Coordinate[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
}

function pointInsideBox(point: EdgePoint, box: ProjectionZone) {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

function overlapAmount(a: ProjectionZone, b: ProjectionZone) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

function mergeBoxes(a: ProjectionZone, b: ProjectionZone): ProjectionZone {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: maxX - x, height: maxY - y };
}

function paddedBox(box: ProjectionZone, padX: number, padY: number): ProjectionZone {
  return {
    x: box.x - padX,
    y: box.y - padY,
    width: box.width + padX * 2,
    height: box.height + padY * 2
  };
}

function clampToProjection(box: ProjectionZone, projection: ProjectionZone): ProjectionZone {
  const x = Math.max(projection.x, box.x);
  const y = Math.max(projection.y, box.y);
  const maxX = Math.min(projection.x + projection.width, box.x + box.width);
  const maxY = Math.min(projection.y + projection.height, box.y + box.height);
  return { x, y, width: Math.max(0, maxX - x), height: Math.max(0, maxY - y) };
}

function boxGap(a: ProjectionZone, b: ProjectionZone) {
  return {
    x: Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width)),
    y: Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  };
}

function buildComponentBoxes(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  const marginX = Math.max(0.75, projectionZone.width * 0.015);
  const marginY = Math.max(0.75, projectionZone.height * 0.018);
  const inner = {
    x: projectionZone.x + marginX,
    y: projectionZone.y + marginY,
    width: Math.max(1, projectionZone.width - marginX * 2),
    height: Math.max(1, projectionZone.height - marginY * 2)
  };

  const strongPoints = edgePoints.filter((point) => pointInsideBox(point, inner) && point.strength >= 92);
  if (!strongPoints.length) return [];

  const cellSize = Math.max(0.32, Math.min(projectionZone.width, projectionZone.height) / 95);
  const grid = new Map<string, { x: number; y: number; count: number; strength: number }>();

  for (const point of strongPoints) {
    const gx = Math.floor((point.x - projectionZone.x) / cellSize);
    const gy = Math.floor((point.y - projectionZone.y) / cellSize);
    const key = `${gx},${gy}`;
    const current = grid.get(key);
    if (current) {
      current.count += 1;
      current.strength += point.strength;
    } else {
      grid.set(key, { x: gx, y: gy, count: 1, strength: point.strength });
    }
  }

  const visited = new Set<string>();
  const boxes: ComponentBox[] = [];
  const offsets = [-1, 0, 1];

  for (const [key, first] of grid) {
    if (visited.has(key)) continue;
    const queue = [first];
    visited.add(key);
    let minGX = first.x;
    let maxGX = first.x;
    let minGY = first.y;
    let maxGY = first.y;
    let cells = 0;
    let edgeCount = 0;
    let strength = 0;

    while (queue.length) {
      const cell = queue.pop()!;
      cells += 1;
      edgeCount += cell.count;
      strength += cell.strength;
      minGX = Math.min(minGX, cell.x);
      maxGX = Math.max(maxGX, cell.x);
      minGY = Math.min(minGY, cell.y);
      maxGY = Math.max(maxGY, cell.y);

      for (const dx of offsets) {
        for (const dy of offsets) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = `${cell.x + dx},${cell.y + dy}`;
          if (visited.has(nextKey)) continue;
          const next = grid.get(nextKey);
          if (!next) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
    }

    const raw = {
      x: projectionZone.x + minGX * cellSize,
      y: projectionZone.y + minGY * cellSize,
      width: (maxGX - minGX + 1) * cellSize,
      height: (maxGY - minGY + 1) * cellSize
    };
    const box = clampToProjection(paddedBox(raw, cellSize * 1.6, cellSize * 1.6), projectionZone);
    const area = box.width * box.height;
    const projectionArea = projectionZone.width * projectionZone.height;
    const aspect = box.width / Math.max(box.height, 0.01);
    const density = edgeCount / Math.max(area, 1);

    if (cells < 8 || edgeCount < 16) continue;
    if (box.width < projectionZone.width * 0.045 || box.height < projectionZone.height * 0.07) continue;
    if (area < projectionArea * 0.004 || area > projectionArea * 0.26) continue;
    if (aspect < 0.22 || aspect > 4.2) continue;

    boxes.push({ ...box, cells, edgeCount, score: density * 20 + Math.min(4, strength / Math.max(edgeCount, 1) / 40) });
  }

  return boxes;
}

function mergeRelatedComponents(boxes: ComponentBox[], projectionZone: ProjectionZone): ComponentBox[] {
  const merged = [...boxes].sort((a, b) => b.score - a.score);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        const a = merged[i];
        const b = merged[j];
        const combined = mergeBoxes(a, b);
        const combinedArea = combined.width * combined.height;
        const projectionArea = projectionZone.width * projectionZone.height;
        const aspect = combined.width / Math.max(combined.height, 0.01);
        const gap = boxGap(a, b);
        const overlap = overlapAmount(a, b);
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        const horizontal = gap.x <= Math.max(1.35, projectionZone.width * 0.028) && gap.y <= Math.max(a.height, b.height) * 0.42;
        const vertical = gap.y <= Math.max(1.35, projectionZone.height * 0.045) && gap.x <= Math.max(a.width, b.width) * 0.42;
        const overlapping = overlap / Math.max(minArea, 1) > 0.18;

        if (!horizontal && !vertical && !overlapping) continue;
        if (combinedArea > projectionArea * 0.22) continue;
        if (combined.width > projectionZone.width * 0.50 || combined.height > projectionZone.height * 0.62) continue;
        if (aspect < 0.24 || aspect > 4.0) continue;

        merged[i] = {
          ...combined,
          score: Math.max(a.score, b.score) + 0.35,
          edgeCount: a.edgeCount + b.edgeCount,
          cells: a.cells + b.cells
        };
        merged.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return merged;
}

function buildWindowCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  const components = buildComponentBoxes(edgePoints, projectionZone);
  const merged = mergeRelatedComponents(components, projectionZone);
  const projectionArea = projectionZone.width * projectionZone.height;
  const sorted = merged
    .filter((box) => {
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      return area >= projectionArea * 0.006 && area <= projectionArea * 0.24 && aspect >= 0.25 && aspect <= 4.0;
    })
    .sort((a, b) => b.score - a.score);

  const accepted: ComponentBox[] = [];
  for (const candidate of sorted) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.42;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 8) break;
  }

  return accepted;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const candidates = buildWindowCandidates(edgePoints, projectionZone);
  return candidates.map((box, index) => ({
    id: `auto_mask_${Date.now()}_${index}`,
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
