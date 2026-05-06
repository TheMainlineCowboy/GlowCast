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
const boxWidth = (box: Box) => box.maxX - box.minX + 1;
const boxHeight = (box: Box) => box.maxY - box.minY + 1;
const boxArea = (box: Box) => Math.max(1, boxWidth(box) * boxHeight(box));

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

  for (let y = Math.floor(height * 0.36); y < Math.floor(height * 0.74); y += 2) {
    for (let x = Math.floor(width * 0.22); x < Math.floor(width * 0.84); x += 2) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;
      const sat = saturation(r, g, b);
      const green = g - Math.max(r, b) > 12 && sat > 0.16;
      if (brightness < 80 || brightness > 242 || sat > 0.38 || green || isLikelySky(r, g, b)) continue;
      const key = `${Math.round(r / 18) * 18},${Math.round(g / 18) * 18},${Math.round(b / 18) * 18}`;
      const count = (buckets.get(key) ?? 0) + 1;
      buckets.set(key, count);
      if (count > bestCount) {
        bestCount = count;
        best = key;
      }
    }
  }

  return best.split(",").map(Number);
}

function boxToZone(box: Box, canvasWidth: number, canvasHeight: number, id: number, pad = 0.012): Zone {
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
    confidence: Math.round(clamp(55 + box.score / 120, 55, 94))
  };
}

function defaultSurface(): Zone {
  return { id: -1, x: 8, y: 30, width: 86, height: 60, included: true, label: "projection surface" };
}

function dilate(mask: Uint8Array, width: number, height: number, radiusX: number, radiusY: number) {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radiusY; dy <= radiusY; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radiusX; dx <= radiusX; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          result[ny * width + nx] = 1;
        }
      }
    }
  }
  return result;
}

function findComponents(mask: Uint8Array, width: number, height: number, label: string, baseScore: number) {
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

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w < 6 || h < 6 || area < 38) continue;
    boxes.push({ minX, minY, maxX, maxY, area, score: baseScore + area, label });
  }

  return boxes;
}

function countOriginalPixels(box: Box, originalMask: Uint8Array, width: number) {
  let count = 0;
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (originalMask[y * width + x]) count += 1;
    }
  }
  return count;
}

function overlap(a: Box, b: Box) {
  const x = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const y = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const intersection = x * y;
  return intersection / Math.max(1, boxArea(a) + boxArea(b) - intersection);
}

function containedRatio(parent: Box, child: Box) {
  const x = Math.max(0, Math.min(parent.maxX, child.maxX) - Math.max(parent.minX, child.minX));
  const y = Math.max(0, Math.min(parent.maxY, child.maxY) - Math.max(parent.minY, child.minY));
  return (x * y) / boxArea(child);
}

function rejectBadArchitecturalBox(box: Box, width: number, height: number, originalDensity: number) {
  const w = boxWidth(box);
  const h = boxHeight(box);
  const aspect = h / Math.max(1, w);
  const centerX = (box.minX + box.maxX) / 2 / width;
  const centerY = (box.minY + box.maxY) / 2 / height;

  const tooSmall = w < width * 0.035 || h < height * 0.055;
  const tooHuge = w > width * 0.34 || h > height * 0.55;
  const upperRightPorchFalsePositive = centerX > 0.64 && centerY < 0.55 && w > width * 0.15 && h > height * 0.12;
  const groundFalsePositive = centerY > 0.70 && aspect < 0.72;
  const nonArchitecturalShape = aspect < 0.38 || aspect > 7.5;
  const tooSparse = originalDensity < 0.075;

  return tooSmall || tooHuge || upperRightPorchFalsePositive || groundFalsePositive || nonArchitecturalShape || tooSparse;
}

function scoreArchitecturalBox(box: Box, width: number, height: number, originalDensity: number) {
  const w = boxWidth(box);
  const h = boxHeight(box);
  const aspect = h / Math.max(1, w);
  const centerX = (box.minX + box.maxX) / 2 / width;
  const centerY = (box.minY + box.maxY) / 2 / height;
  let score = box.score;

  if (aspect > 1.2 && h > height * 0.18) score += 4200; // doors and sidelights
  if (aspect > 0.45 && aspect < 1.45 && w > width * 0.08 && h > height * 0.07) score += 2600; // horizontal windows
  if (centerY > 0.36 && centerY < 0.72) score += 1200;
  if (centerX > 0.15 && centerX < 0.78) score += 900;
  score += originalDensity * 3000;

  return score;
}

function chooseBoxes(boxes: Box[], width: number, height: number) {
  const sorted = boxes.sort((a, b) => b.score - a.score);
  const kept: Box[] = [];

  for (const candidate of sorted) {
    const blocked = kept.some((existing) => overlap(existing, candidate) > 0.24 || containedRatio(existing, candidate) > 0.78 || containedRatio(candidate, existing) > 0.90);
    if (!blocked) kept.push(candidate);
    if (kept.length >= 6) break;
  }

  return kept.sort((a, b) => a.minX - b.minX || a.minY - b.minY);
}

export async function detectSurfaceAndMasks(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = Math.max(120, Math.round(image.naturalHeight * (420 / image.naturalWidth)));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const wall = estimateWallColor(data, canvas.width, canvas.height);

  const darkMask = new Uint8Array(canvas.width * canvas.height);
  const fixtureMask = new Uint8Array(canvas.width * canvas.height);

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
      const pixel = y * canvas.width + x;
      const architecturalBand = y > canvas.height * 0.30 && y < canvas.height * 0.86;

      if (architecturalBand && !green && !isLikelySky(r, g, b) && brightness < 168 && diff > 16) darkMask[pixel] = 1;
      if (architecturalBand && !green && !isLikelySky(r, g, b) && sat > 0.50 && diff > 80 && brightness > 85 && brightness < 230) fixtureMask[pixel] = 1;
    }
  }

  const closedDarkMask = dilate(darkMask, canvas.width, canvas.height, 3, 4);
  const rawArchitectural = findComponents(closedDarkMask, canvas.width, canvas.height, "door / window / glass", 2400)
    .map((box) => {
      const originalCount = countOriginalPixels(box, darkMask, canvas.width);
      const originalDensity = originalCount / boxArea(box);
      return { ...box, area: originalCount, score: scoreArchitecturalBox(box, canvas.width, canvas.height, originalDensity) };
    })
    .filter((box) => !rejectBadArchitecturalBox(box, canvas.width, canvas.height, box.area / boxArea(box)));

  const fixtureBoxes = findComponents(dilate(fixtureMask, canvas.width, canvas.height, 1, 1), canvas.width, canvas.height, "sign / wall fixture", 650)
    .filter((box) => {
      const w = boxWidth(box);
      const h = boxHeight(box);
      const centerX = (box.minX + box.maxX) / 2 / canvas.width;
      const centerY = (box.minY + box.maxY) / 2 / canvas.height;
      return centerY > 0.34 && centerY < 0.68 && centerX < 0.86 && w < canvas.width * 0.08 && h < canvas.height * 0.12 && w > canvas.width * 0.018 && h > canvas.height * 0.025;
    });

  const masks = chooseBoxes([...rawArchitectural, ...fixtureBoxes], canvas.width, canvas.height);
  return { surface: defaultSurface(), masks: masks.map((box, index) => boxToZone(box, canvas.width, canvas.height, Date.now() + index, box.label.includes("door") ? 0.012 : 0.008)) };
}
