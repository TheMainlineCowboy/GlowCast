export type Zone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  label?: string;
  confidence?: number;
};

type Box = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  score: number;
  label: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max ? (max - min) / max : 0;
}

function distance(r: number, g: number, b: number, target: number[]) {
  return Math.hypot(r - target[0], g - target[1], b - target[2]);
}

function isLikelySky(r: number, g: number, b: number) {
  return b > r + 18 && b > g + 10 && g > r - 5;
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function estimateWallColor(data: Uint8ClampedArray, width: number, height: number) {
  const buckets = new Map<string, number>();
  let best = "200,200,200";
  let bestCount = 0;
  const regions = [
    { x1: 0.22, x2: 0.78, y1: 0.38, y2: 0.76 },
    { x1: 0.18, x2: 0.82, y1: 0.30, y2: 0.82 },
    { x1: 0.30, x2: 0.70, y1: 0.22, y2: 0.62 }
  ];

  for (const region of regions) {
    const startX = Math.floor(width * region.x1);
    const endX = Math.floor(width * region.x2);
    const startY = Math.floor(height * region.y1);
    const endY = Math.floor(height * region.y2);
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const brightness = (r + g + b) / 3;
        const sat = saturation(r, g, b);
        const green = g - Math.max(r, b) > 12 && sat > 0.16;
        if (brightness < 80 || brightness > 240 || sat > 0.34 || green || isLikelySky(r, g, b)) continue;
        const key = `${Math.round(r / 18) * 18},${Math.round(g / 18) * 18},${Math.round(b / 18) * 18}`;
        const count = (buckets.get(key) ?? 0) + 1;
        buckets.set(key, count);
        if (count > bestCount) {
          bestCount = count;
          best = key;
        }
      }
    }
  }
  return best.split(",").map(Number);
}

function boxToZone(box: Box, canvasWidth: number, canvasHeight: number, id: number, pad = 0.01): Zone {
  const padX = canvasWidth * pad;
  const padY = canvasHeight * pad;
  const x1 = clamp(((box.minX - padX) / canvasWidth) * 100);
  const y1 = clamp(((box.minY - padY) / canvasHeight) * 100);
  const x2 = clamp(((box.maxX + padX) / canvasWidth) * 100);
  const y2 = clamp(((box.maxY + padY) / canvasHeight) * 100);
  return {
    id,
    x: Number(x1.toFixed(2)),
    y: Number(y1.toFixed(2)),
    width: Number((x2 - x1).toFixed(2)),
    height: Number((y2 - y1).toFixed(2)),
    included: true,
    label: box.label,
    confidence: Math.round(clamp(55 + box.score / 100, 55, 94))
  };
}

function findWallComponents(data: Uint8ClampedArray, width: number, height: number, wallColor: number[]) {
  const mask = new Uint8Array(width * height);
  const xMin = Math.floor(width * 0.08);
  const xMax = Math.floor(width * 0.92);
  const yMin = Math.floor(height * 0.08);
  const yMax = Math.floor(height * 0.86);
  for (let y = yMin; y < yMax; y += 1) {
    const yRatio = y / height;
    const centerAllowance = yRatio < 0.24;
    const rowCenter = width * 0.5;
    const gableHalfWidth = width * (0.20 + Math.max(0, yRatio - 0.08) * 1.6);
    for (let x = xMin; x < xMax; x += 1) {
      if (centerAllowance && Math.abs(x - rowCenter) > gableHalfWidth) continue;
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;
      const sat = saturation(r, g, b);
      const green = g - Math.max(r, b) > 12 && sat > 0.16;
      const wallLike = distance(r, g, b, wallColor) < 52 && brightness > 75 && brightness < 245 && sat < 0.42 && !green && !isLikelySky(r, g, b);
      if (wallLike) mask[y * width + x] = 1;
    }
  }
  return findComponents(mask, width, height, "projection surface", 1000, {
    allowLarge: true,
    allowEdges: false,
    minArea: width * height * 0.014,
    maxArea: width * height * 0.50
  });
}

function detectSurface(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, wallColor: number[]): Zone {
  const components = findWallComponents(data, canvasWidth, canvasHeight, wallColor)
    .map((box) => {
      const centerX = (box.minX + box.maxX) / 2 / canvasWidth;
      const centerY = (box.minY + box.maxY) / 2 / canvasHeight;
      const boxWidth = box.maxX - box.minX + 1;
      const boxHeight = box.maxY - box.minY + 1;
      let score = box.area;
      score += (1 - Math.abs(centerX - 0.5)) * 1800;
      score += (1 - Math.abs(centerY - 0.48)) * 900;
      if (boxWidth > canvasWidth * 0.3 && boxHeight > canvasHeight * 0.22) score += 1200;
      if (box.minY < canvasHeight * 0.18 && box.maxY > canvasHeight * 0.42) score += 900;
      if (box.minX < canvasWidth * 0.05 || box.maxX > canvasWidth * 0.95) score -= 1800;
      if (box.minY < canvasHeight * 0.055 || box.maxY > canvasHeight * 0.92) score -= 1200;
      return { ...box, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = components[0];
  if (!best) return { id: -1, x: 16, y: 20, width: 68, height: 58, included: true, label: "projection surface" };
  return boxToZone(best, canvasWidth, canvasHeight, -1, 0.025);
}

type ComponentOptions = { allowLarge?: boolean; allowEdges?: boolean; minArea?: number; maxArea?: number; };

function findComponents(mask: Uint8Array, width: number, height: number, label: string, baseScore: number, options: ComponentOptions = {}) {
  const seen = new Uint8Array(mask.length);
  const boxes: Box[] = [];
  const queue: number[] = [];
  const minArea = options.minArea ?? 28;
  const maxArea = options.maxArea ?? width * height * 0.18;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    seen[start] = 1;
    queue.length = 0;
    queue.push(start);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    while (queue.length) {
      const point = queue.pop() as number;
      const x = point % width;
      const y = Math.floor(point / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      area += 1;
      for (const next of [point - 1, point + 1, point - width, point + width]) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue;
        if (Math.abs((next % width) - x) > 1) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const boxArea = boxWidth * boxHeight;
    const centerX = (minX + maxX) / 2 / width;
    const centerY = (minY + maxY) / 2 / height;
    if (area < minArea || boxWidth < 5 || boxHeight < 5) continue;
    if (boxArea > maxArea) continue;
    if (!options.allowLarge && (boxWidth > width * 0.75 || boxHeight > height * 0.7)) continue;
    if (!options.allowEdges && (minX < width * 0.01 || maxX > width * 0.99)) continue;
    if (label.includes("plant") && centerY < 0.32) continue;
    if (label.includes("window") && (centerY < 0.1 || boxWidth < width * 0.035 || boxHeight < height * 0.05)) continue;
    let score = baseScore + area;
    if (centerX > 0.16 && centerX < 0.84) score += 260;
    if (centerY > 0.12 && centerY < 0.9) score += 220;
    boxes.push({ minX, minY, maxX, maxY, area, score, label });
  }
  return boxes;
}

function overlap(a: Box, b: Box) {
  const x = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const y = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const intersection = x * y;
  const areaA = Math.max(1, (a.maxX - a.minX) * (a.maxY - a.minY));
  const areaB = Math.max(1, (b.maxX - b.minX) * (b.maxY - b.minY));
  return intersection / Math.max(1, areaA + areaB - intersection);
}

function containsBox(parent: Box, child: Box) {
  return parent.minX <= child.minX && parent.minY <= child.minY && parent.maxX >= child.maxX && parent.maxY >= child.maxY;
}

function removeParentBoxes(boxes: Box[]) {
  return boxes.filter((box) => {
    const boxArea = Math.max(1, (box.maxX - box.minX) * (box.maxY - box.minY));
    const children = boxes.filter((candidate) => {
      if (candidate === box) return false;
      const candidateArea = Math.max(1, (candidate.maxX - candidate.minX) * (candidate.maxY - candidate.minY));
      return candidateArea < boxArea * 0.62 && containsBox(box, candidate);
    });
    if (children.length < 2) return true;
    const childAreaTotal = children.reduce((sum, child) => sum + Math.max(1, (child.maxX - child.minX) * (child.maxY - child.minY)), 0);
    return childAreaTotal < boxArea * 0.24;
  });
}

function nearbySameObject(a: Box, b: Box, width: number, height: number) {
  if (a.label !== b.label) return false;
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapY = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
  const centerAX = (a.minX + a.maxX) / 2;
  const centerAY = (a.minY + a.maxY) / 2;
  const centerBX = (b.minX + b.maxX) / 2;
  const centerBY = (b.minY + b.maxY) / 2;
  const closeCenters = Math.abs(centerAX - centerBX) < width * 0.11 && Math.abs(centerAY - centerBY) < height * 0.16;
  if (a.label.includes("window")) return closeCenters || (gapX < width * 0.035 && gapY < height * 0.08);
  if (a.label.includes("plant")) return closeCenters || (gapX < width * 0.055 && gapY < height * 0.08);
  return overlap(a, b) > 0.18;
}

function mergeNearbyBoxes(boxes: Box[], width: number, height: number) {
  const merged: Box[] = [];
  for (const box of boxes) {
    let current = box;
    let changed = true;
    while (changed) {
      changed = false;
      const index = merged.findIndex((candidate) => nearbySameObject(candidate, current, width, height));
      if (index >= 0) {
        const candidate = merged.splice(index, 1)[0];
        current = {
          minX: Math.min(candidate.minX, current.minX),
          minY: Math.min(candidate.minY, current.minY),
          maxX: Math.max(candidate.maxX, current.maxX),
          maxY: Math.max(candidate.maxY, current.maxY),
          area: candidate.area + current.area,
          score: Math.max(candidate.score, current.score) + Math.min(candidate.area, current.area),
          label: current.label
        };
        changed = true;
      }
    }
    merged.push(current);
  }
  return merged;
}

function insideZone(box: Box, zone: Zone, width: number, height: number) {
  const zoneX1 = (zone.x / 100) * width;
  const zoneY1 = (zone.y / 100) * height;
  const zoneX2 = zoneX1 + (zone.width / 100) * width;
  const zoneY2 = zoneY1 + (zone.height / 100) * height;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return cx >= zoneX1 && cx <= zoneX2 && cy >= zoneY1 && cy <= zoneY2;
}

export async function detectSurfaceAndMasks(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = Math.max(100, Math.round(image.naturalHeight * (340 / image.naturalWidth)));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const wall = estimateWallColor(data, canvas.width, canvas.height);
  const surface = detectSurface(data, canvas.width, canvas.height, wall);
  const darkMask = new Uint8Array(canvas.width * canvas.height);
  const plantMask = new Uint8Array(canvas.width * canvas.height);
  const objectMask = new Uint8Array(canvas.width * canvas.height);
  for (let y = 2; y < canvas.height - 2; y += 1) {
    for (let x = 2; x < canvas.width - 2; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;
      const sat = saturation(r, g, b);
      const diff = distance(r, g, b, wall);
      const green = g - Math.max(r, b) > 10 && sat > 0.16;
      const dark = brightness < 116 && diff > 20;
      const pixel = y * canvas.width + x;
      if (dark && y > canvas.height * 0.08 && y < canvas.height * 0.9) darkMask[pixel] = 1;
      if (green && y > canvas.height * 0.28) plantMask[pixel] = 1;
      if ((diff > 62 || sat > 0.52) && y > canvas.height * 0.08 && y < canvas.height * 0.95) objectMask[pixel] = 1;
    }
  }
  const rawCandidates = [
    ...findComponents(darkMask, canvas.width, canvas.height, "window / dark opening", 1900),
    ...findComponents(plantMask, canvas.width, canvas.height, "plant / landscaping", 1700, { allowEdges: true }),
    ...findComponents(objectMask, canvas.width, canvas.height, "avoid object", 400)
  ]
    .filter((box) => box.label.includes("plant") || insideZone(box, surface, canvas.width, canvas.height))
    .sort((a, b) => b.score - a.score);
  const candidates = removeParentBoxes(mergeNearbyBoxes(rawCandidates, canvas.width, canvas.height)).sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const candidate of candidates) {
    if (kept.some((existing) => overlap(existing, candidate) > 0.28 || containsBox(existing, candidate))) continue;
    kept.push(candidate);
    if (kept.length >= 8) break;
  }
  return { surface, masks: kept.map((box, index) => boxToZone(box, canvas.width, canvas.height, Date.now() + index)) };
}
