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

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function estimateWallColor(data: Uint8ClampedArray) {
  const buckets = new Map<string, number>();
  let best = "200,200,200";
  let bestCount = 0;

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const brightness = (r + g + b) / 3;
    const sat = saturation(r, g, b);

    if (brightness < 75 || brightness > 245 || sat > 0.36) continue;

    const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
    const count = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, count);

    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }

  return best.split(",").map(Number);
}

function boxToZone(box: Box, canvasWidth: number, canvasHeight: number, id: number): Zone {
  const padX = canvasWidth * 0.01;
  const padY = canvasHeight * 0.01;
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

function detectSurface(data: Uint8ClampedArray, canvasWidth: number, canvasHeight: number, wallColor: number[]): Zone {
  let minX = canvasWidth;
  let minY = canvasHeight;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = Math.floor(canvasHeight * 0.06); y < Math.floor(canvasHeight * 0.9); y += 1) {
    let rowMin = canvasWidth;
    let rowMax = 0;
    let rowCount = 0;

    for (let x = 0; x < canvasWidth; x += 1) {
      const index = (y * canvasWidth + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;
      const sat = saturation(r, g, b);
      const green = g - Math.max(r, b) > 14 && sat > 0.16;
      const wallLike = distance(r, g, b, wallColor) < 44 && brightness > 70 && brightness < 245 && !green;

      if (!wallLike) continue;

      rowCount += 1;
      rowMin = Math.min(rowMin, x);
      rowMax = Math.max(rowMax, x);
    }

    if (rowCount > canvasWidth * 0.18) {
      minX = Math.min(minX, rowMin);
      maxX = Math.max(maxX, rowMax);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      count += rowCount;
    }
  }

  if (count < canvasWidth * canvasHeight * 0.04 || minX >= maxX || minY >= maxY) {
    return { id: -1, x: 0, y: 0, width: 100, height: 100, included: true, label: "projection surface" };
  }

  return boxToZone({ minX, minY, maxX, maxY, area: count, score: 100, label: "projection surface" }, canvasWidth, canvasHeight, -1);
}

function findComponents(mask: Uint8Array, data: Uint8ClampedArray, width: number, height: number, label: string, baseScore: number) {
  const seen = new Uint8Array(mask.length);
  const boxes: Box[] = [];
  const queue: number[] = [];

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

    if (area < 28 || boxWidth < 5 || boxHeight < 5) continue;
    if (boxArea > width * height * 0.18) continue;
    if (boxWidth > width * 0.75 || boxHeight > height * 0.7) continue;
    if (minY < height * 0.06) continue;
    if (minX < width * 0.01 || maxX > width * 0.99) continue;
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

export async function detectSurfaceAndMasks(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = Math.max(100, Math.round(image.naturalHeight * (340 / image.naturalWidth)));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const wall = estimateWallColor(data);
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

  const candidates = [
    ...findComponents(darkMask, data, canvas.width, canvas.height, "window / dark opening", 1900),
    ...findComponents(plantMask, data, canvas.width, canvas.height, "plant / landscaping", 1700),
    ...findComponents(objectMask, data, canvas.width, canvas.height, "avoid object", 400)
  ].sort((a, b) => b.score - a.score);

  const kept: Box[] = [];
  for (const candidate of candidates) {
    if (kept.some((existing) => overlap(existing, candidate) > 0.28)) continue;
    kept.push(candidate);
    if (kept.length >= 8) break;
  }

  return {
    surface,
    masks: kept.map((box, index) => boxToZone(box, canvas.width, canvas.height, Date.now() + index))
  };
}
