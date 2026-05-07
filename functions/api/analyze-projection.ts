type Env = {
  GEOMETRY_API_URL?: string;
  GEOMETRY_API_KEY?: string;
  SAM2_API_URL?: string;
  SAM2_API_KEY?: string;
  SAM2_MODEL_VERSION?: string;
  DEPTH_API_URL?: string;
  DEPTH_API_KEY?: string;
  DEPTH_MODEL_VERSION?: string;
};

type Point = { x: number; y: number };
type Polygon = Point[];
type ProjectionMask = {
  id: string;
  label: string;
  confidence: number;
  polygon: Polygon;
  svgPath: string;
  alphaMaskUrl?: string;
  depthRole?: "recessed" | "protruding" | "surface";
};

type ProjectionAnalysis = {
  surface: { polygon: Polygon; svgPath: string; homography?: number[]; depthPlane?: { mean: number; tolerance: number } };
  masks: ProjectionMask[];
  depth?: { outputUrl?: string };
  flattenedTemplate: { width: number; height: number; aspectRatio: "16:9" };
  debug: { geometryProvider: string; segmentationProvider: string; depthProvider: string; warnings: string[] };
};

const REPLICATE_URL = "https://api.replicate.com/v1/predictions";
const DEFAULT_SAM2_VERSION = "";
const DEFAULT_DEPTH_VERSION = "";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: { "Content-Type": "application/json" }
});

function polygonToSvgPath(points: Polygon) {
  if (!points.length) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} Z`;
}

function fallbackSurface(): ProjectionAnalysis["surface"] {
  const polygon = [
    { x: 0.08, y: 0.30 },
    { x: 0.94, y: 0.30 },
    { x: 0.94, y: 0.90 },
    { x: 0.08, y: 0.90 }
  ];
  return { polygon, svgPath: polygonToSvgPath(polygon) };
}

function rectanglePolygon(x: number, y: number, width: number, height: number): Polygon {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
}

function normalizeProviderMasks(raw: any): ProjectionMask[] {
  const output = raw?.output ?? raw;
  const masks = output?.masks ?? output?.segments ?? output?.polygons ?? [];

  if (Array.isArray(masks)) {
    return masks.map((mask: any, index: number) => {
      const polygon = (mask.polygon ?? mask.points ?? mask.contour ?? []) as Polygon;
      const fallback = rectanglePolygon(0.18 + index * 0.08, 0.34, 0.12, 0.36);
      const finalPolygon = Array.isArray(polygon) && polygon.length >= 3 ? polygon : fallback;
      return {
        id: String(mask.id ?? `mask-${index + 1}`),
        label: String(mask.label ?? "architectural opening"),
        confidence: Number(mask.confidence ?? 0.72),
        polygon: finalPolygon,
        svgPath: mask.svgPath ?? polygonToSvgPath(finalPolygon),
        alphaMaskUrl: mask.url ?? mask.mask ?? mask.mask_url,
        depthRole: mask.depthRole
      } satisfies ProjectionMask;
    });
  }

  if (Array.isArray(output)) {
    return output.slice(0, 6).map((item: any, index: number) => {
      const polygon = rectanglePolygon(0.18 + index * 0.08, 0.34, 0.12, 0.36);
      return {
        id: `mask-${index + 1}`,
        label: "segmentation mask",
        confidence: 0.65,
        polygon,
        svgPath: polygonToSvgPath(polygon),
        alphaMaskUrl: typeof item === "string" ? item : item?.url ?? item?.mask
      };
    });
  }

  if (typeof output === "string") {
    const polygon = rectanglePolygon(0.22, 0.34, 0.20, 0.48);
    return [{ id: "mask-1", label: "segmentation mask", confidence: 0.60, polygon, svgPath: polygonToSvgPath(polygon), alphaMaskUrl: output }];
  }

  return [];
}

async function createPrediction(url: string, key: string, version: string, input: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ version, input })
  });
  if (!response.ok) throw new Error(`Replicate create failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<any>;
}

async function pollPrediction(prediction: any, key: string) {
  let current = prediction;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (current.status === "succeeded") return current;
    if (current.status === "failed" || current.status === "canceled") throw new Error(`Replicate ${current.status}: ${current.error ?? "no error message"}`);
    if (!current.urls?.get) throw new Error("Replicate prediction did not include a polling URL.");
    await new Promise((resolve) => setTimeout(resolve, attempt < 5 ? 900 : 1600));
    const response = await fetch(current.urls.get, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Replicate poll failed: ${response.status} ${await response.text()}`);
    current = await response.json();
  }
  throw new Error("Replicate prediction timed out.");
}

async function runReplicate(url: string | undefined, key: string | undefined, version: string | undefined, input: Record<string, unknown>, label: string) {
  if (!key) throw new Error(`${label} API key missing.`);
  if (!version) throw new Error(`${label} model version missing. Add ${label === "SAM2" ? "SAM2_MODEL_VERSION" : "DEPTH_MODEL_VERSION"} in Cloudflare.`);
  return pollPrediction(await createPrediction(url || REPLICATE_URL, key, version, input), key);
}

async function analyze(imageDataUrl: string, env: Env, refinement?: { positivePoints?: Point[]; negativePoints?: Point[]; maskInsetOutsetPx?: number }) {
  const warnings: string[] = [];
  let segmentation: any = null;
  let depth: any = null;

  try {
    segmentation = await runReplicate(env.SAM2_API_URL, env.SAM2_API_KEY, env.SAM2_MODEL_VERSION || DEFAULT_SAM2_VERSION, {
      image: imageDataUrl,
      prompt: "architectural openings, window glass, door frames, glass panels, lights, vents, protruding fixtures",
      points: refinement?.positivePoints ?? [],
      negative_points: refinement?.negativePoints ?? []
    }, "SAM2");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "SAM2 provider failed.");
  }

  try {
    depth = await runReplicate(env.DEPTH_API_URL, env.DEPTH_API_KEY, env.DEPTH_MODEL_VERSION || DEFAULT_DEPTH_VERSION, {
      image: imageDataUrl
    }, "DEPTH");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Depth provider failed.");
  }

  const masks = normalizeProviderMasks(segmentation);
  const outset = refinement?.maskInsetOutsetPx ?? 0;
  if (outset) warnings.push(`Mask inset/outset requested: ${outset}px. Apply vector offset during rendering/export.`);

  return {
    surface: fallbackSurface(),
    masks,
    depth: { outputUrl: typeof depth?.output === "string" ? depth.output : Array.isArray(depth?.output) ? depth.output[0] : undefined },
    flattenedTemplate: { width: 1920, height: 1080, aspectRatio: "16:9" },
    debug: {
      geometryProvider: env.GEOMETRY_API_URL ? "configured but not yet used" : "not used",
      segmentationProvider: env.SAM2_API_KEY ? "replicate" : "missing",
      depthProvider: env.DEPTH_API_KEY ? "replicate" : "missing",
      warnings
    }
  } satisfies ProjectionAnalysis;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as { imageDataUrl?: string; refinement?: { positivePoints?: Point[]; negativePoints?: Point[]; maskInsetOutsetPx?: number } };
    if (!body.imageDataUrl?.startsWith("data:image/")) return json({ error: "imageDataUrl is required as a data:image/* URL." }, 400);
    return json(await analyze(body.imageDataUrl, env, body.refinement));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Projection analysis failed." }, 500);
  }
};
