import { readFileSync, writeFileSync } from "node:fs";

const p = "src/edgeDetect.ts";
let s = readFileSync(p, "utf8");

s = s.replace(
  'function createEdgeRegionCanvasUrl(edgePoints: EdgePoint[], sourceWidth: number, sourceHeight: number) {',
  'function createEdgeRegionCanvasUrlFromDarkGlass(source: ImageData) {'
);

const start = s.indexOf('function createEdgeRegionCanvasUrlFromDarkGlass(source: ImageData) {');
const end = s.indexOf('\n\nexport async function scanImageEdges', start);

if (start >= 0 && end > start) {
  const replacement = `function createEdgeRegionCanvasUrlFromDarkGlass(source: ImageData) {
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const maxSize = 560;
  const scale = Math.min(maxSize / sourceWidth, maxSize / sourceHeight, 1);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const dark = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.max(0, Math.min(sourceWidth - 1, Math.floor(x / scale)));
      const sy = Math.max(0, Math.min(sourceHeight - 1, Math.floor(y / scale)));
      const si = (sy * sourceWidth + sx) * 4;
      const r = source.data[si];
      const g = source.data[si + 1];
      const b = source.data[si + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = max - min;
      const coolBias = b + g * 0.65 - r * 1.25;
      const likelyGlass = brightness < 118 && (chroma > 12 || coolBias > 30);
      dark[y * width + x] = likelyGlass ? 1 : 0;
    }
  }

  const visited = new Uint8Array(width * height);
  const keep = new Uint8Array(width * height);
  const minBoxArea = Math.max(500, Math.round(width * height * 0.0035));
  const maxBoxArea = Math.round(width * height * 0.13);

  for (let start = 0; start < dark.length; start += 1) {
    if (!dark[start] || visited[start]) continue;
    const queue = [start];
    const pixels: number[] = [];
    visited[start] = 1;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;

    for (let head = 0; head < queue.length; head += 1) {
      const i = queue[head];
      pixels.push(i);
      const x = i % width;
      const y = Math.floor(i / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const next = [i + 1, i - 1, i + width, i - width];
      for (const n of next) {
        if (n < 0 || n >= dark.length) continue;
        if (Math.abs((n % width) - x) > 1) continue;
        if (!dark[n] || visited[n]) continue;
        visited[n] = 1;
        queue.push(n);
      }
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const boxArea = bw * bh;
    const aspect = bw / Math.max(1, bh);
    const fill = pixels.length / Math.max(1, boxArea);
    const touchesImageEdge = minX <= 2 || minY <= 2 || maxX >= width - 3 || maxY >= height - 3;
    const windowLike = !touchesImageEdge && boxArea >= minBoxArea && boxArea <= maxBoxArea && bw >= 22 && bh >= 18 && aspect >= 0.45 && aspect <= 3.2 && fill >= 0.20;

    if (windowLike) {
      const pad = Math.max(2, Math.round(Math.min(bw, bh) * 0.08));
      for (let yy = Math.max(0, minY - pad); yy <= Math.min(height - 1, maxY + pad); yy += 1) {
        for (let xx = Math.max(0, minX - pad); xx <= Math.min(width - 1, maxX + pad); xx += 1) {
          keep[yy * width + xx] = 1;
        }
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < keep.length; i += 1) {
    const px = i * 4;
    image.data[px] = 0;
    image.data[px + 1] = 0;
    image.data[px + 2] = 0;
    image.data[px + 3] = keep[i] ? 255 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}`;
  s = s.slice(0, start) + replacement + s.slice(end);
}

s = s.replace(
  'edgeRegionCanvasUrl: createEdgeRegionCanvasUrl(edgePoints, width, height),',
  'edgeRegionCanvasUrl: createEdgeRegionCanvasUrlFromDarkGlass(source),'
);

writeFileSync(p, s);
