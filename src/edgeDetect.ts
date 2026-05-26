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

type GridCell = {
  x: number;
  y: number;
  points: EdgePoint[];
  visited: boolean;
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

function insideZone(point: EdgePoint, zone: ProjectionZone) {
  return point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height;
}

function rectPoints(box: ProjectionZone): Coordinate[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
}

function overlapAmount(a: ProjectionZone, b: ProjectionZone) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

function candidateScore(zone: ProjectionZone, pointCount: number) {
  const area = Math.max(1, zone.width * zone.height);
  const aspect = zone.width / Math.max(zone.height, 0.01);
  const windowAspectBonus = aspect >= 0.35 && aspect <= 3.2 ? 1.25 : 0.75;
  return (pointCount / area) * windowAspectBonus;
}

export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const containedPoints = edgePoints.filter((point) => insideZone(point, projectionZone));
  if (!containedPoints.length) return [];

  const cellSize = Math.max(0.8, Math.min(3, options.clusterRadius));
  const grid = new Map<string, GridCell>();
  const keyFor = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;

  for (const point of containedPoints) {
    const key = keyFor(point.x, point.y);
    const [gx, gy] = key.split(",").map(Number);
    const cell = grid.get(key) ?? { x: gx, y: gy, points: [], visited: false };
    cell.points.push(point);
    grid.set(key, cell);
  }

  const denseCells = new Map([...grid.entries()].filter(([, cell]) => cell.points.length >= 2));
  const components: EdgePoint[][] = [];

  for (const [startKey, startCell] of denseCells.entries()) {
    if (startCell.visited) continue;
    const queue = [startKey];
    const component: EdgePoint[] = [];
    startCell.visited = true;

    while (queue.length) {
      const key = queue.shift()!;
      const cell = denseCells.get(key);
      if (!cell) continue;
      component.push(...cell.points);

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = denseCells.get(`${cell.x + dx},${cell.y + dy}`);
          if (!neighbor || neighbor.visited) continue;
          neighbor.visited = true;
          queue.push(`${cell.x + dx},${cell.y + dy}`);
        }
      }
    }

    if (component.length >= options.minPoints) components.push(component);
  }

  const maxCandidateArea = projectionZone.width * projectionZone.height * 0.35;
  const candidates = components
    .map((points) => {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const pad = Math.max(0.7, cellSize * 0.35);
      const x = Math.max(projectionZone.x, Math.min(...xs) - pad);
      const y = Math.max(projectionZone.y, Math.min(...ys) - pad);
      const maxX = Math.min(projectionZone.x + projectionZone.width, Math.max(...xs) + pad);
      const maxY = Math.min(projectionZone.y + projectionZone.height, Math.max(...ys) + pad);
      const box = { x, y, width: maxX - x, height: maxY - y };
      return { box, count: points.length, score: candidateScore(box, points.length) };
    })
    .filter(({ box, count }) => {
      const area = box.width * box.height;
      const aspect = box.width / Math.max(box.height, 0.01);
      return (
        count >= options.minPoints &&
        box.width >= 2.5 &&
        box.height >= 2.5 &&
        box.width <= projectionZone.width * 0.75 &&
        box.height <= projectionZone.height * 0.75 &&
        area <= maxCandidateArea &&
        aspect >= 0.2 &&
        aspect <= 5
      );
    })
    .sort((a, b) => b.score - a.score);

  const accepted: ProjectionZone[] = [];

  for (const candidate of candidates) {
    const candidateArea = candidate.box.width * candidate.box.height;
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate.box);
      const existingArea = existing.width * existing.height;
      return overlap / Math.min(existingArea, candidateArea) > 0.45;
    });

    if (!duplicate) accepted.push(candidate.box);
    if (accepted.length >= 24) break;
  }

  return accepted.map((box, index) => ({
    id: `auto_mask_${Date.now()}_${index}`,
    type: "auto-generated",
    shape: "polygon",
    points: rectPoints(box),
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
