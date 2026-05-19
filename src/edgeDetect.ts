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

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

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

  return {
    width,
    height,
    edgeCanvasUrl: edgeCanvas.toDataURL("image/png"),
    edgePoints
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
