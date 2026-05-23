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

type CellStats = {
  r: number;
  g: number;
  b: number;
  gray: number;
  chroma: number;
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
  const steps = 12;
  const strength = 380 + Math.min(150, box.score * 5);

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

function neighborAverage(grid: CellStats[], gridW: number, gridH: number, gx: number, gy: number, radius: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  let gray = 0;
  let chroma = 0;
  let count = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const cell = grid[ny * gridW + nx];
      r += cell.r;
      g += cell.g;
      b += cell.b;
      gray += cell.gray;
      chroma += cell.chroma;
      count++;
    }
  }

  const safe = Math.max(1, count);
  return {
    r: r / safe,
    g: g / safe,
    b: b / safe,
    gray: gray / safe,
    chroma: chroma / safe
  };
}

function cellDistance(a: CellStats, b: CellStats) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) + Math.abs(a.gray - b.gray) * 0.7 + Math.abs(a.chroma - b.chroma) * 1.2;
}

function scoreRectPanel(
  grid: CellStats[],
  objectGrid: Uint8Array,
  gridW: number,
  gridH: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number
) {
  let insideR = 0;
  let insideG = 0;
  let insideB = 0;
  let insideGray = 0;
  let insideChroma = 0;
  let insideCount = 0;
  let insideObject = 0;
  let perimeterObject = 0;
  let perimeterCount = 0;

  for (let y = sy; y < sy + sh; y++) {
    for (let x = sx; x < sx + sw; x++) {
      const idx = y * gridW + x;
      const cell = grid[idx];
      insideR += cell.r;
      insideG += cell.g;
      insideB += cell.b;
      insideGray += cell.gray;
      insideChroma += cell.chroma;
      insideCount++;
      if (objectGrid[idx]) insideObject++;

      const onEdge = x === sx || y === sy || x === sx + sw - 1 || y === sy + sh - 1;
      if (onEdge) {
        perimeterCount++;
        if (objectGrid[idx]) perimeterObject++;
      }
    }
  }

  if (!insideCount || !perimeterCount) return 0;

  const inner: CellStats = {
    r: insideR / insideCount,
    g: insideG / insideCount,
    b: insideB / insideCount,
    gray: insideGray / insideCount,
    chroma: insideChroma / insideCount
  };

  let outsideR = 0;
  let outsideG = 0;
  let outsideB = 0;
  let outsideGray = 0;
  let outsideChroma = 0;
  let outsideCount = 0;

  const ox0 = Math.max(0, sx - 2);
  const oy0 = Math.max(0, sy - 2);
  const ox1 = Math.min(gridW, sx + sw + 2);
  const oy1 = Math.min(gridH, sy + sh + 2);

  for (let y = oy0; y < oy1; y++) {
    for (let x = ox0; x < ox1; x++) {
      if (x >= sx && x < sx + sw && y >= sy && y < sy + sh) continue;
      const cell = grid[y * gridW + x];
      outsideR += cell.r;
      outsideG += cell.g;
      outsideB += cell.b;
      outsideGray += cell.gray;
      outsideChroma += cell.chroma;
      outsideCount++;
    }
  }

  if (!outsideCount) return 0;

  const outer: CellStats = {
    r: outsideR / outsideCount,
    g: outsideG / outsideCount,
    b: outsideB / outsideCount,
    gray: outsideGray / outsideCount,
    chroma: outsideChroma / outsideCount
  };

  let variance = 0;
  for (let y = sy; y < sy + sh; y++) {
    for (let x = sx; x < sx + sw; x++) {
      variance += cellDistance(grid[y * gridW + x], inner);
    }
  }

  const avgVariance = variance / insideCount;
  const outsideDelta = cellDistance(inner, outer);
  const borderRatio = perimeterObject / perimeterCount;
  const insideRatio = insideObject / insideCount;
  const coherence = Math.max(0, 1 - avgVariance / 75);

  return outsideDelta * 1.3 + borderRatio * 80 + insideRatio * 30 + coherence * 35;
}

function createGenericPanelBoxes(grid: CellStats[], objectGrid: Uint8Array, gridW: number, gridH: number) {
  const candidates: RegionBox[] = [];
  const widths = [7, 9, 11, 14, 17, 21, 25, 30, 36];
  const heights = [7, 9, 11, 14, 18, 23, 29, 36, 44];

  for (const sw of widths) {
    for (const sh of heights) {
      const aspect = sw / Math.max(1, sh);
      if (aspect < 0.18 || aspect > 5.25) continue;

      const stepX = Math.max(2, Math.floor(sw / 3));
      const stepY = Math.max(2, Math.floor(sh / 3));

      for (let sy = 1; sy <= gridH - sh - 1; sy += stepY) {
        for (let sx = 1; sx <= gridW - sw - 1; sx += stepX) {
          const score = scoreRectPanel(grid, objectGrid, gridW, gridH, sx, sy, sw, sh);
          if (score < 82) continue;

          const x = (sx / gridW) * 100;
          const y = (sy / gridH) * 100;
          const width = (sw / gridW) * 100;
          const height = (sh / gridH) * 100;
          const area = width * height;

          if (width < 4 || height < 4) continue;
          if (width > 42 || height > 58) continue;
          if (area < 16 || area > 1100) continue;

          candidates.push({ x, y, width, height, score });
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 30);
}

function createRegionHintPoints(source: ImageData, width: number, height: number): EdgePoint[] {
  const gridW = 108;
  const gridH = Math.max(44, Math.round((height / width) * gridW));
  const grid: CellStats[] = [];
  const grayValues: number[] = [];
  const contrastValues: number[] = [];
  const objectGrid = new Uint8Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor((gx / gridW) * width);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / gridW) * width));
      const y0 = Math.floor((gy / gridH) * height);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) / gridH) * height));

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += source.data[i];
          g += source.data[i + 1];
          b += source.data[i + 2];
          count++;
        }
      }

      const safe = Math.max(1, count);
      const rr = r / safe;
      const gg = g / safe;
      const bb = b / safe;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);

      const cell: CellStats = {
        r: rr,
        g: gg,
        b: bb,
        gray: 0.299 * rr + 0.587 * gg + 0.114 * bb,
        chroma: max - min
      };

      grid.push(cell);
      grayValues.push(cell.gray);
    }
  }

  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const idx = gy * gridW + gx;
      const c = grid[idx];
      const left = grid[idx - 1].gray;
      const right = grid[idx + 1].gray;
      const up = grid[idx - gridW].gray;
      const down = grid[idx + gridW].gray;

      contrastValues.push(
        Math.abs(c.gray - left) +
          Math.abs(c.gray - right) +
          Math.abs(c.gray - up) +
          Math.abs(c.gray - down)
      );
    }
  }

  const globalDark = quantile(grayValues, 0.30);
  const globalLight = quantile(grayValues, 0.78);
  const contrastCutoff = Math.max(18, quantile(contrastValues, 0.78));

  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const idx = gy * gridW + gx;
      const cell = grid[idx];
      const local = neighborAverage(grid, gridW, gridH, gx, gy, 5);

      const colorDelta =
        Math.abs(cell.r - local.r) +
        Math.abs(cell.g - local.g) +
        Math.abs(cell.b - local.b);

      const edgeContrast =
        Math.abs(cell.gray - grid[idx - 1].gray) +
        Math.abs(cell.gray - grid[idx + 1].gray) +
        Math.abs(cell.gray - grid[idx - gridW].gray) +
        Math.abs(cell.gray - grid[idx + gridW].gray);

      const darkerRecess = cell.gray < local.gray - 14 || cell.gray < globalDark - 2;
      const lighterGlass = cell.gray > local.gray + 20 && cell.gray > globalLight - 10;
      const colorObject = colorDelta > 34 || Math.abs(cell.chroma - local.chroma) > 12;
      const edgeObject = edgeContrast > contrastCutoff;

      objectGrid[idx] = darkerRecess || lighterGlass || colorObject || edgeObject ? 1 : 0;
    }
  }

  const seen = new Uint8Array(objectGrid.length);
  const boxes: RegionBox[] = [];

  for (let start = 0; start < objectGrid.length; start++) {
    if (!objectGrid[start] || seen[start]) continue;

    const stack = [start];
    seen[start] = 1;

    let minX = gridW;
    let minY = gridH;
    let maxX = 0;
    let maxY = 0;
    let cells = 0;
    let score = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % gridW;
      const y = Math.floor(idx / gridW);
      const cell = grid[idx];
      const local = neighborAverage(grid, gridW, gridH, x, y, 4);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      cells++;
      score += cell.chroma + Math.abs(cell.gray - local.gray);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;

          const next = ny * gridW + nx;
          if (!objectGrid[next] || seen[next]) continue;

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

    if (w < 4.0 || h < 4.0) continue;
    if (w > 40 || h > 52) continue;
    if (area < 16 || area > 950) continue;
    if (aspect < 0.20 || aspect > 5.2) continue;
    if (fill < 0.15) continue;

    const touchesPhotoEdge = x < 1 || y < 1 || x + w > 99 || y + h > 99;
    if (touchesPhotoEdge) continue;

    boxes.push({
      x,
      y,
      width: w,
      height: h,
      score: score / Math.max(1, cells) + cells * 0.7 + fill * 18
    });
  }

  boxes.push(...createGenericPanelBoxes(grid, objectGrid, gridW, gridH));
  boxes.sort((a, b) => b.score - a.score);

  const selected: RegionBox[] = [];
  for (const box of boxes) {
    if (selected.some((other) => overlapRatio(box, other) > 0.42)) continue;
    selected.push(box);
    if (selected.length >= 16) break;
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

        rawEdges.push({
          x: (x / width) * 100,
          y: (y / height) * 100,
          strength
        });
      }
    }
  }

  edgeCtx.putImageData(edgeImage, 0, 0);

  const maxPoints = 9000;
  const stride = Math.max(1, Math.ceil(rawEdges.length / maxPoints));
  const edgePoints = rawEdges.filter((_, index) => index % stride === 0);
  const regionHints = createRegionHintPoints(source, width, height);

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
