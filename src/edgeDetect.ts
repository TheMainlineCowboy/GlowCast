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

type CellCandidate = ProjectionZone & { score: number; edgeCount: number };

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

function overlapAmount(a: ProjectionZone, b: ProjectionZone) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

function pointInsideBox(point: EdgePoint, box: ProjectionZone) {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

function scoreBox(points: EdgePoint[], box: ProjectionZone, projectionZone: ProjectionZone): CellCandidate | null {
  const inside = points.filter((point) => pointInsideBox(point, box));
  if (inside.length < 18) return null;

  const area = box.width * box.height;
  const projectionArea = projectionZone.width * projectionZone.height;
  const aspect = box.width / Math.max(box.height, 0.01);
  if (area < 18 || area > projectionArea * 0.22) return null;
  if (box.width < projectionZone.width * 0.07 || box.height < projectionZone.height * 0.08) return null;
  if (box.width > projectionZone.width * 0.5 || box.height > projectionZone.height * 0.45) return null;
  if (aspect < 0.35 || aspect > 3.4) return null;

  const sideHits = [0, 0, 0, 0];
  for (const point of inside) {
    const nx = (point.x - box.x) / Math.max(box.width, 0.01);
    const ny = (point.y - box.y) / Math.max(box.height, 0.01);
    if (ny < 0.28) sideHits[0] += 1;
    if (ny > 0.72) sideHits[1] += 1;
    if (nx < 0.28) sideHits[2] += 1;
    if (nx > 0.72) sideHits[3] += 1;
  }

  const sideCoverage = sideHits.filter((count) => count >= Math.max(3, inside.length * 0.08)).length;
  if (sideCoverage < 2) return null;

  const density = inside.length / Math.max(area, 1);
  const aspectBonus = aspect >= 0.55 && aspect <= 2.4 ? 1.4 : 1;
  const coverageBonus = sideCoverage / 4;
  const sizePenalty = area / Math.max(projectionArea, 1);
  const score = density * aspectBonus * (1 + coverageBonus) - sizePenalty;
  return { ...box, score, edgeCount: inside.length };
}

function mergeBoxes(a: ProjectionZone, b: ProjectionZone): ProjectionZone {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: maxX - x, height: maxY - y };
}

function buildWindowCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): CellCandidate[] {
  const points = edgePoints.filter((point) => pointInsideBox(point, projectionZone));
  const candidates: CellCandidate[] = [];
  const minW = Math.max(6, projectionZone.width * 0.12);
  const maxW = Math.max(minW + 1, projectionZone.width * 0.36);
  const minH = Math.max(6, projectionZone.height * 0.14);
  const maxH = Math.max(minH + 1, projectionZone.height * 0.34);
  const stepX = Math.max(2, projectionZone.width / 24);
  const stepY = Math.max(2, projectionZone.height / 24);
  const widths = [minW, (minW + maxW) / 2, maxW];
  const heights = [minH, (minH + maxH) / 2, maxH];

  for (const width of widths) {
    for (const height of heights) {
      for (let y = projectionZone.y; y <= projectionZone.y + projectionZone.height - height; y += stepY) {
        for (let x = projectionZone.x; x <= projectionZone.x + projectionZone.width - width; x += stepX) {
          const scored = scoreBox(points, { x, y, width, height }, projectionZone);
          if (scored) candidates.push(scored);
        }
      }
    }
  }

  const accepted: CellCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.35;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < accepted.length; i += 1) {
      for (let j = i + 1; j < accepted.length; j += 1) {
        const first = accepted[i];
        const second = accepted[j];
        const overlap = overlapAmount(first, second);
        const minArea = Math.min(first.width * first.height, second.width * second.height);
        if (overlap / Math.max(minArea, 1) > 0.2) {
          const combined = mergeBoxes(first, second);
          accepted[i] = {
            ...combined,
            score: Math.max(first.score, second.score),
            edgeCount: first.edgeCount + second.edgeCount
          };
          accepted.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return accepted.sort((a, b) => b.score - a.score).slice(0, 8);
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
