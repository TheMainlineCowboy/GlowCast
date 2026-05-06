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

type Box = { minX: number; minY: number; maxX: number; maxY: number; area: number; score: number; label: string; };

type ComponentOptions = { allowLarge?: boolean; allowEdges?: boolean; minArea?: number; maxArea?: number; };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const boxArea = (box: Box) => Math.max(1, (box.maxX - box.minX) * (box.maxY - box.minY));
const boxWidth = (box: Box) => box.maxX - box.minX + 1;
const boxHeight = (box: Box) => box.maxY - box.minY + 1;

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
        if (brightness < 80 || brightness > 242 || sat > 0.36 || green || isLikelySky(r, g, b)) continue;
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

function findComponents(mask: Uint8Array, width: number, height: number, label: string, baseScore: number, options: ComponentOptions = {}) {
  const seen = new Uint8Array(mask.length);
  const boxes: Box[] = [];
  const queue: number[] = [];
  const minArea = options.minArea ?? 28;
  const maxArea = options.maxArea ?? width * height * 0.20;

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
    const areaOfBox = w * h;
    const centerX = (minX + maxX) / 2 / width;
    const centerY = (minY + maxY) / 2 / height;
    if (area < minArea || w < 4 || h < 4) continue;
    if (areaOfBox > maxArea) continue;
    if (!options.allowLarge && (w > width * 0.78 || h > height * 0.78)) continue;
    if (!options.allowEdges && (minX < width * 0.01 || maxX > width * 0.99)) continue;
    let score = baseScore + area;
    if (centerX > 0.14 && centerX < 0.86) score += 260;
    if (centerY > 0.16 && centerY < 0.9) score += 220;
    boxes.push({ minX, minY, maxX, maxY, area, score, label });
  }
  return boxes;
}

function wallLikePixel(data: Uint8ClampedArray, index: number, wallColor: number[]) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const brightness = (r + g + b) / 3;
  const sat = saturation(r, g, b);
  const green = g - Math.max(r, b) > 12 && sat > 0.16;
  return distance(r, g, b, wallColor) < 58 && brightness > 70 && brightness < 247 && sat < 0.44 && !green && !isLikelySky(r, g, b);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)))];
}

function detectSurface(data: Uint8ClampedArray, width: number, height: number, wallColor: number[]): Zone {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = Math.floor(height * 0.24); y < Math.floor(height * 0.88); y += 1) {
    for (let x = Math.floor(width * 0.06); x < Math.floor(width * 0.94); x += 1) {
      if (!wallLikePixel(data, (y * width + x) * 4, wallColor)) continue;
      xs.push(x);
      ys.push(y);
    }
  }

  if (xs.length < width * height * 0.04) return { id: -1, x: 10, y: 30, width: 82, height: 62, included: true, label: "projection surface" };

  const x1 = quantile(xs, 0.03);
  const x2 = quantile(xs, 0.97);
  const y1 = quantile(ys, 0.04);
  const y2 = quantile(ys, 0.98);
  const w = ((x2 - x1) / width) * 100;
  const h = ((y2 - y1) / height) * 100;

  if (w < 30 || h < 25) return { id: -1, x: 10, y: 30, width: 82, height: 62, included: true, label: "projection surface" };

  return {
    id: -1,
    x: Number(clamp((x1 / width) * 100, 6, 18).toFixed(2)),
    y: Number(clamp((y1 / height) * 100, 22, 38).toFixed(2)),
    width: Number(clamp(w, 62, 86).toFixed(2)),
    height: Number(clamp(h, 48, 68).toFixed(2)),
    included: true,
    label: "projection surface"
  };
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

function expandBox(box: Box, xPad: number, yPad: number): Box {
  return { ...box, minX: box.minX - xPad, minY: box.minY - yPad, maxX: box.maxX + xPad, maxY: box.maxY + yPad };
}

function shouldMergeAsArchitecture(a: Box, b: Box, width: number, height: number) {
  const ax = (a.minX + a.maxX) / 2;
  const ay = (a.minY + a.maxY) / 2;
  const bx = (b.minX + b.maxX) / 2;
  const by = (b.minY + b.maxY) / 2;
  const sameVerticalObject = Math.abs(ax - bx) < width * 0.07 && Math.abs(ay - by) < height * 0.28;
  const adjacentWindowPanels = Math.abs(ay - by) < height * 0.11 && Math.abs(ax - bx) < width * 0.16;
  const expandedOverlap = overlap(expandBox(a, width * 0.02, height * 0.035), expandBox(b, width * 0.02, height * 0.035)) > 0;
  return expandedOverlap || sameVerticalObject || adjacentWindowPanels;
}

function mergeArchitecturalBoxes(boxes: Box[], width: number, height: number) {
  const merged: Box[] = [];
  for (const box of boxes) {
    let current = box;
    let changed = true;
    while (changed) {
      changed = false;
      const index = merged.findIndex((candidate) => shouldMergeAsArchitecture(candidate, current, width, height));
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

function insideSurfaceOrLikelyDoor(box: Box, surface: Zone, width: number, height: number) {
  const sx1 = (surface.x / 100) * width;
  const sy1 = (surface.y / 100) * height;
  const sx2 = sx1 + (surface.width / 100) * width;
  const sy2 = sy1 + (surface.height / 100) * height;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const inside = cx >= sx1 - width * 0.05 && cx <= sx2 + width * 0.05 && cy >= sy1 - height * 0.06 && cy <= sy2 + height * 0.08;
  const lowerArchitectural = cy > height * 0.33 && cy < height * 0.90 && boxHeight(box) > height * 0.09;
  return inside || lowerArchitectural;
}

function scoreDarkArchitecture(box: Box, width: number, height: number) {
  const w = boxWidth(box);
  const h = boxHeight(box);
  const aspect = h / Math.max(1, w);
  const centerY = (box.minY + box.maxY) / 2 / height;
  const centerX = (box.minX + box.maxX) / 2 / width;
  let score = box.score;
  if (aspect > 1.15 && aspect < 6.5) score += 1200;
  if (h > height * 0.18 && centerY > 0.43) score += 2400; // door / tall sidelight
  if (w > width * 0.05 && h > height * 0.08) score += 900; // window / glass panel
  if (centerX > 0.10 && centerX < 0.84) score += 500;
  if (centerY < 0.28) score -= 1800;
  return score;
}

function rejectFalsePositive(box: Box, width: number, height: number) {
  const w = boxWidth(box);
  const h = boxHeight(box);
  const centerX = (box.minX + box.maxX) / 2 / width;
  const centerY = (box.minY + box.maxY) / 2 / height;
  const aspect = h / Math.max(1, w);
  const upperRightPorchPatch = centerX > 0.74 && centerY < 0.43 && w > width * 0.08 && h > height * 0.07;
  const tinyRandomPatch = w < width * 0.025 || h < height * 0.025;
  const unrealisticWidePatch = aspect < 0.22 || aspect > 8;
  return upperRightPorchPatch || tinyRandomPatch || unrealisticWidePatch;
}

function preferSpecificBoxes(boxes: Box[], width: number, height: number) {
  const sorted = boxes
    .filter((box) => !rejectFalsePositive(box, width, height))
    .sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const candidate of sorted) {
    const blocked = kept.some((existing) => overlap(existing, candidate) > 0.28 || containedRatio(existing, candidate) > 0.82 || containedRatio(candidate, existing) > 0.92);
    if (!blocked) kept.push(candidate);
    if (kept.length >= 8) break;
  }
  return kept;
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
  const surface = detectSurface(data, canvas.width, canvas.height, wall);

  const darkMask = new Uint8Array(canvas.width * canvas.height);
  const plantMask = new Uint8Array(canvas.width * canvas.height);
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
      const lowerWall = y > canvas.height * 0.26 && y < canvas.height * 0.92;
      const darkArchitectural = brightness < 150 && diff > 18 && lowerWall && !green && !isLikelySky(r, g, b);
      if (darkArchitectural) darkMask[pixel] = 1;
      if (green && y > canvas.height * 0.32) plantMask[pixel] = 1;
      if ((diff > 72 || sat > 0.55) && lowerWall && brightness > 95 && brightness < 235 && !green && !isLikelySky(r, g, b)) fixtureMask[pixel] = 1;
    }
  }

  const darkBoxes = mergeArchitecturalBoxes(
    findComponents(darkMask, canvas.width, canvas.height, "door / window / dark opening", 2100, {
      allowLarge: true,
      allowEdges: false,
      minArea: canvas.width * canvas.height * 0.00035,
      maxArea: canvas.width * canvas.height * 0.18
    }),
    canvas.width,
    canvas.height
  )
    .filter((box) => insideSurfaceOrLikelyDoor(box, surface, canvas.width, canvas.height))
    .map((box) => ({ ...box, score: scoreDarkArchitecture(box, canvas.width, canvas.height) }))
    .filter((box) => {
      const w = boxWidth(box);
      const h = boxHeight(box);
      return w > canvas.width * 0.035 && h > canvas.height * 0.07;
    });

  const plantBoxes = findComponents(plantMask, canvas.width, canvas.height, "plant / landscaping", 1300, {
    allowEdges: true,
    minArea: canvas.width * canvas.height * 0.001,
    maxArea: canvas.width * canvas.height * 0.10
  }).filter((box) => (box.minY + box.maxY) / 2 > canvas.height * 0.55);

  const fixtureBoxes = findComponents(fixtureMask, canvas.width, canvas.height, "sign / wall fixture", 800, {
    allowEdges: false,
    minArea: canvas.width * canvas.height * 0.00025,
    maxArea: canvas.width * canvas.height * 0.018
  }).filter((box) => {
    const w = boxWidth(box);
    const h = boxHeight(box);
    const centerY = (box.minY + box.maxY) / 2 / canvas.height;
    return insideSurfaceOrLikelyDoor(box, surface, canvas.width, canvas.height) && centerY > 0.32 && w < canvas.width * 0.12 && h < canvas.height * 0.16;
  });

  const kept = preferSpecificBoxes([...darkBoxes, ...plantBoxes, ...fixtureBoxes], canvas.width, canvas.height);
  return { surface, masks: kept.map((box, index) => boxToZone(box, canvas.width, canvas.height, Date.now() + index, box.label.includes("door") ? 0.012 : 0.008)) };
}
