export type EdgePoint = {
  x: number;
  y: number;
  strength: number;
};

export type EdgeScanResult = {
  width: number;
  height: number;
  edgeCanvasUrl: string;
  edgePoints: EdgePoint[];
};

type RegionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)))];
}

function overlapRatio(a: RegionBox, b: RegionBox) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

function addBoxHintPoints(points: EdgePoint[], box: RegionBox) {
  const steps = 10;
  const strength = 340 + Math.min(120, box.score * 6);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = box.x + box.width * t;
    const y = box.y + box.height * t;

    points.push({ x, y: box.y, strength });
    points.push({ x, y: box.y + box.height, strength });
    points.push({ x: box.x, y, strength });
    points.push({ x: box.x + box.width, y, strength });
  }
}

function createRegionHintPoints(gray: Uint8ClampedArray, width: number, height: number): EdgePoint[] {
  const gridW = 96;
  const gridH = Math.max(42, Math.round((height / width) * gridW));
  const values: number[] = [];
  const avgGrid = new Float32Array(gridW * gridH);
  const darkGrid = new Uint8Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor((gx / gridW) * width);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / gridW) * width));
      const y0 = Math.floor((gy / gridH) * height);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) / gridH) * height));
      let sum = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }

      const avg = sum / Math.max(1, count);
      avgGrid[gy * gridW + gx] = avg;
      values.push(avg);
    }
  }

  const globalDark = quantile(values, 0.30);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      const avg = avgGrid[idx];
      let localSum = 0;
      let localCount = 0;

      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
          localSum += avgGrid[ny * gridW + nx];
          localCount++;
        }
      }

      const localAvg = localSum / Math.max(1, localCount);
      const isLocalRecess = avg < localAvg - 18;
      const isGloballyDark = avg < globalDark - 4;
      darkGrid[idx] = isLocalRecess || isGloballyDark ? 1 : 0;
    }
  }

  const seen = new Uint8Array(darkGrid.length);
  const boxes: RegionBox[] = [];

  for (let start = 0; start < darkGrid.length; start++) {
    if (!darkGrid[start] || seen[start]) continue;

    const stack = [start];
    seen[start] = 1;
    let minX = gridW;
    let minY = gridH;
    let maxX = 0;
    let maxY = 0;
    let cells = 0;
    let darkness = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % gridW;
      const y = Math.floor(idx / gridW);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      cells++;
      darkness += 255 - avgGrid[idx];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
          const next = ny * gridW + nx;
          if (!darkGrid[next] || seen[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }

    const x = (minX / gridW) * 100;
    const y = (minY / gridH) * 100;
    const w = ((maxX - minX + 1) / gridW) * 100;
    const h = ((maxY - minY + 1) / gridH) * 100;
    const area = w * h;
    const aspect = w / Math.max(0.001, h);
    const gridArea = (maxX - minX + 1) * (maxY - minY + 1);
    const fill = cells / Math.max(1, gridArea);

    if (w < 4.2 || h < 4.2) continue;
    if (w > 38 || h > 48) continue;
    if (area < 18 || area > 900) continue;
    if (aspect < 0.22 || aspect > 4.8) continue;
    if (fill < 0.20) continue;

    const touchesPhotoEdge = x < 1.2 || y < 1.2 || x + w > 98.8 || y + h > 98.8;
    if (touchesPhotoEdge) continue;

    boxes.push({
      x,
      y,
      width: w,
      height: h,
      score: (darkness / Math.max(1, cells)) * fill + cells * 0.6
    });
  }

  boxes.sort((a, b) => b.score - a.score);

  const selected: RegionBox[] = [];
  for (const box of boxes) {
    if (selected.some((other) => overlapRatio(box, other) > 0.45)) continue;
    selected.push(box);
    if (selected.length >= 12) break;
  }

  const hints: EdgePoint[] = [];
  selected.forEach((box) => addBoxHintPoints(hints, box));
  return hints;
}

export async function scanImageEdges(imageUrl: string): Promise<EdgeScanResult> {
  const image = await loadImageElement(imageUrl);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;

  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    throw new Error("Could not create source canvas.");
  }

  sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { width, height } = source;
  const gray = new Uint8ClampedArray(width * height);

  for (let i = 0; i < source.data.length; i += 4) {
    const r = source.data[i];
    const g = source.data[i + 1];
    const b = source.data[i + 2];

    gray[i / 4] = clampByte(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.width = width;
  edgeCanvas.height = height;

  const edgeCtx = edgeCanvas.getContext("2d");
  if (!edgeCtx) {
    throw new Error("Could not create edge overlay.");
  }

  const edgeImage = edgeCtx.createImageData(width, height);
  const rawEdges: EdgePoint[] = [];

  const threshold = 48;
  const step = 1;

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const index = y * width + x;

      const gx =
        -gray[index - width - 1] +
        gray[index - width + 1] -
        2 * gray[index - 1] +
        2 * gray[index + 1] -
        gray[index + width - 1] +
        gray[index + width + 1];

      const gy =
        -gray[index - width - 1] -
        2 * gray[index - width] -
        gray[index - width + 1] +
        gray[index + width - 1] +
        2 * gray[index + width] +
        gray[index + width + 1];

      const strength = Math.sqrt(gx * gx + gy * gy);

      if (strength > threshold) {
        const pixel = index * 4;
        edgeImage.data[pixel] = 34;
        edgeImage.data[pixel + 1] = 211;
        edgeImage.data[pixel + 2] = 238;
        edgeImage.data[pixel + 3] = clampByte(Math.min(255, strength));

        rawEdges.push({ x: (x / width) * 100, y: (y / height) * 100, strength });
      }
    }
  }

  edgeCtx.putImageData(edgeImage, 0, 0);

  const maxPoints = 9000;
  const stride = Math.max(1, Math.ceil(rawEdges.length / maxPoints));
  const edgePoints = rawEdges.filter((_, index) => index % stride === 0);
  const regionHints = createRegionHintPoints(gray, width, height);

  return {
    width,
    height,
    edgeCanvasUrl: edgeCanvas.toDataURL("image/png"),
    edgePoints: [...edgePoints, ...regionHints]
  };
}

export function snapPointToEdge(
  point: { x: number; y: number },
  edgePoints: EdgePoint[],
  radiusPercent = 1.2
) {
  if (!edgePoints.length) return point;

  let best = point;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const edge of edgePoints) {
    const dx = edge.x - point.x;
    const dy = edge.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radiusPercent) {
      const score = distance - edge.strength / 1000;

      if (score < bestScore) {
        bestScore = score;
        best = {
          x: edge.x,
          y: edge.y
        };
      }
    }
  }

  return best;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));

    image.src = src;
  });
}
