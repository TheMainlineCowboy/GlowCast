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

type ApiPoint = { x: number; y: number };
type ApiMask = { label?: string; confidence?: number; polygon?: ApiPoint[]; points?: ApiPoint[] };
type ApiAnalysis = { surface?: { polygon?: ApiPoint[] }; masks?: ApiMask[]; debug?: { warnings?: string[] } };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function defaultSurface(): Zone {
  return { id: -1, x: 8, y: 30, width: 86, height: 60, included: true, label: "projection surface" };
}

function polygonToZone(points: ApiPoint[] | undefined, id: number, label: string, confidence = 70): Zone | null {
  if (!Array.isArray(points) || points.length < 3) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (maxX <= 1.5 && maxY <= 1.5) {
    minX *= 100;
    maxX *= 100;
    minY *= 100;
    maxY *= 100;
  }

  const x = clamp(minX);
  const y = clamp(minY);
  const width = clamp(maxX - minX, 1, 100 - x);
  const height = clamp(maxY - minY, 1, 100 - y);
  if (width < 1 || height < 1) return null;

  return {
    id,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    included: true,
    label,
    confidence
  };
}

function fallbackMasks(): Zone[] {
  const base = Date.now();
  return [
    { id: base + 1, x: 21, y: 36, width: 11, height: 45, included: true, label: "large glass panel", confidence: 55 },
    { id: base + 2, x: 33, y: 35, width: 14, height: 49, included: true, label: "front door", confidence: 55 },
    { id: base + 3, x: 57, y: 38, width: 21, height: 15, included: true, label: "window", confidence: 55 },
    { id: base + 4, x: 50, y: 38, width: 5, height: 16, included: true, label: "wall fixture", confidence: 50 }
  ];
}

export async function detectSurfaceAndMasks(imageUrl: string) {
  try {
    const response = await fetch("/api/analyze-projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: imageUrl })
    });

    if (!response.ok) throw new Error(await response.text());
    const analysis = await response.json() as ApiAnalysis;
    const masks = (analysis.masks ?? [])
      .map((mask, index) => polygonToZone(mask.polygon ?? mask.points, Date.now() + index, mask.label ?? "AI avoid mask", Math.round((mask.confidence ?? 0.7) * 100)))
      .filter(Boolean) as Zone[];

    return {
      surface: polygonToZone(analysis.surface?.polygon, -1, "projection surface", 80) ?? defaultSurface(),
      masks: masks.length ? masks : fallbackMasks(),
      warnings: analysis.debug?.warnings ?? []
    };
  } catch (error) {
    console.warn("Projection API detection failed; using fallback masks.", error);
    return { surface: defaultSurface(), masks: fallbackMasks(), warnings: [error instanceof Error ? error.message : "Projection API failed"] };
  }
}
