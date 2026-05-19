import { readFileSync, writeFileSync } from "node:fs";

const p = "src/edgeDetect.ts";
let s = readFileSync(p, "utf8");

s = s.replace(
  '  edgeCanvasUrl: string;\n  edgePoints: EdgePoint[];',
  '  edgeCanvasUrl: string;\n  edgeRegionCanvasUrl: string;\n  edgePoints: EdgePoint[];'
);

if (!s.includes("function createEdgeRegionCanvasUrl")) {
  s = s.replace('export async function scanImageEdges', `function growPixels(input: Uint8Array, width: number, height: number, passes: number) {
  let current = input;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Uint8Array(current);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        if (!current[i]) continue;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) next[(y + oy) * width + x + ox] = 1;
        }
      }
    }
    current = next;
  }
  return current;
}

function outsidePixels(blocked: Uint8Array, width: number, height: number) {
  const outside = new Uint8Array(width * height);
  const queue: number[] = [];
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (blocked[i] || outside[i]) return;
    outside[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y += 1) { add(0, y); add(width - 1, y); }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head];
    const x = i % width;
    const y = Math.floor(i / width);
    add(x + 1, y); add(x - 1, y); add(x, y + 1); add(x, y - 1);
  }
  return outside;
}

function createEdgeRegionCanvasUrl(edgePoints: EdgePoint[], sourceWidth: number, sourceHeight: number) {
  const maxSize = 520;
  const scale = Math.min(maxSize / sourceWidth, maxSize / sourceHeight, 1);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const edges = new Uint8Array(width * height);
  for (const point of edgePoints) {
    const x = Math.max(0, Math.min(width - 1, Math.round((point.x / 100) * width)));
    const y = Math.max(0, Math.min(height - 1, Math.round((point.y / 100) * height)));
    edges[y * width + x] = 1;
  }
  const closedEdges = growPixels(edges, width, height, 3);
  const outside = outsidePixels(closedEdges, width, height);
  const raw = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i += 1) raw[i] = !closedEdges[i] && !outside[i] ? 1 : 0;

  const visited = new Uint8Array(width * height);
  const keep = new Uint8Array(width * height);
  const minArea = Math.max(20, Math.round(width * height * 0.00025));
  const maxArea = Math.round(width * height * 0.24);
  for (let start = 0; start < raw.length; start += 1) {
    if (!raw[start] || visited[start]) continue;
    const queue = [start];
    const pixels: number[] = [];
    visited[start] = 1;
    let minX = start % width, maxX = minX, minY = Math.floor(start / width), maxY = minY;
    for (let head = 0; head < queue.length; head += 1) {
      const i = queue[head];
      pixels.push(i);
      const x = i % width;
      const y = Math.floor(i / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const next = [i + 1, i - 1, i + width, i - width];
      for (const n of next) {
        if (n < 0 || n >= raw.length) continue;
        if (Math.abs((n % width) - x) > 1) continue;
        if (!raw[n] || visited[n]) continue;
        visited[n] = 1;
        queue.push(n);
      }
    }
    const area = pixels.length;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = bw / Math.max(1, bh);
    const fill = area / Math.max(1, bw * bh);
    if (area >= minArea && area <= maxArea && bw >= 5 && bh >= 5 && aspect >= 0.18 && aspect <= 5.5 && fill >= 0.18) {
      for (const px of pixels) keep[px] = 1;
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
    image.data[px] = 0; image.data[px + 1] = 0; image.data[px + 2] = 0; image.data[px + 3] = keep[i] ? 255 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function scanImageEdges`);
}

s = s.replace(
  '    edgeCanvasUrl: edgeCanvas.toDataURL("image/png"),\n    edgePoints',
  '    edgeCanvasUrl: edgeCanvas.toDataURL("image/png"),\n    edgeRegionCanvasUrl: createEdgeRegionCanvasUrl(edgePoints, width, height),\n    edgePoints'
);

writeFileSync(p, s);
