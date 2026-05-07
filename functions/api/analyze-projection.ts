type Env = {
  SAM2_API_URL?: string;
  SAM2_API_KEY?: string;
  SAM2_MODEL?: string;
  SAM2_MODEL_VERSION?: string;
  DEPTH_API_URL?: string;
  DEPTH_API_KEY?: string;
  DEPTH_MODEL?: string;
  DEPTH_MODEL_VERSION?: string;
  GEOMETRY_API_URL?: string;
  GEOMETRY_API_KEY?: string;
};

type Point = { x: number; y: number };
type Polygon = Point[];
type ProjectionMask = { id: string; label: string; confidence: number; polygon: Polygon; svgPath: string; alphaMaskUrl?: string };
type ProjectionAnalysis = { surface: { polygon: Polygon; svgPath: string }; masks: ProjectionMask[]; depth?: { outputUrl?: string }; flattenedTemplate: { width: number; height: number; aspectRatio: "16:9" }; debug: { geometryProvider: string; segmentationProvider: string; depthProvider: string; warnings: string[] } };

const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const REPLICATE_MODELS_URL = "https://api.replicate.com/v1/models";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });

function polygonToSvgPath(points: Polygon) {
  if (!points.length) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} Z`;
}

function fallbackSurface(): ProjectionAnalysis["surface"] {
  const polygon = [{ x: 0.08, y: 0.30 }, { x: 0.94, y: 0.30 }, { x: 0.94, y: 0.90 }, { x: 0.08, y: 0.90 }];
  return { polygon, svgPath: polygonToSvgPath(polygon) };
}

function rectanglePolygon(x: number, y: number, width: number, height: number): Polygon {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}

function normalizeProviderMasks(raw: any): ProjectionMask[] {
  const output = raw?.output ?? raw;
  const masks = output?.masks ?? output?.segments ?? output?.polygons;
  if (Array.isArray(masks)) {
    return masks.slice(0, 8).map((mask: any, index: number) => {
      const polygon = mask.polygon ?? mask.points ?? mask.contour;
      const finalPolygon = Array.isArray(polygon) && polygon.length >= 3 ? polygon : rectanglePolygon(0.18 + index * 0.08, 0.34, 0.12, 0.36);
      return { id: String(mask.id ?? `mask-${index + 1}`), label: String(mask.label ?? "architectural opening"), confidence: Number(mask.confidence ?? 0.72), polygon: finalPolygon, svgPath: mask.svgPath ?? polygonToSvgPath(finalPolygon), alphaMaskUrl: mask.url ?? mask.mask ?? mask.mask_url };
    });
  }
  if (Array.isArray(output)) {
    return output.slice(0, 6).map((item: any, index: number) => {
      const polygon = rectanglePolygon(0.18 + index * 0.08, 0.34, 0.12, 0.36);
      return { id: `mask-${index + 1}`, label: "segmentation mask", confidence: 0.65, polygon, svgPath: polygonToSvgPath(polygon), alphaMaskUrl: typeof item === "string" ? item : item?.url ?? item?.mask };
    });
  }
  if (typeof output === "string") {
    const polygon = rectanglePolygon(0.22, 0.34, 0.20, 0.48);
    return [{ id: "mask-1", label: "segmentation mask", confidence: 0.60, polygon, svgPath: polygonToSvgPath(polygon), alphaMaskUrl: output }];
  }
  return [];
}

function modelPredictionUrl(model?: string) {
  const [owner, name] = (model ?? "").split("/");
  return owner && name ? `${REPLICATE_MODELS_URL}/${owner}/${name}/predictions` : REPLICATE_PREDICTIONS_URL;
}

async function createPrediction(args: { key: string; url?: string; model?: string; version?: string; input: Record<string, unknown> }) {
  const hasVersion = Boolean(args.version && args.version !== "pending");
  const url = hasVersion ? (args.url || REPLICATE_PREDICTIONS_URL) : modelPredictionUrl(args.model);
  const body = hasVersion ? { version: args.version, input: args.input } : { input: args.input };
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.key}` }, body: JSON.stringify(body) });
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

async function runReplicate(config: { key?: string; url?: string; model?: string; version?: string; input: Record<string, unknown>; label: string }) {
  if (!config.key) throw new Error(`${config.label} API key missing.`);
  if ((!config.model || config.model === "pending") && (!config.version || config.version === "pending")) throw new Error(`${config.label} model missing.`);
  return pollPrediction(await createPrediction({ key: config.key, url: config.url, model: config.model, version: config.version, input: config.input }), config.key);
}

async function analyze(imageDataUrl: string, env: Env, refinement?: { positivePoints?: Point[]; negativePoints?: Point[]; maskInsetOutsetPx?: number }) {
  const warnings: string[] = [];
  let segmentation: any = null;
  let depth: any = null;
  try {
    segmentation = await runReplicate({ key: env.SAM2_API_KEY, url: env.SAM2_API_URL, model: env.SAM2_MODEL || "meta/sam-2", version: env.SAM2_MODEL_VERSION, input: { image: imageDataUrl, prompt: "architectural openings, window glass, door frames, glass panels, lights, vents, protruding fixtures", points: refinement?.positivePoints ?? [], negative_points: refinement?.negativePoints ?? [] }, label: "SAM2" });
  } catch (error) { warnings.push(error instanceof Error ? error.message : "SAM2 provider failed."); }
  try {
    depth = await runReplicate({ key: env.DEPTH_API_KEY, url: env.DEPTH_API_URL, model: env.DEPTH_MODEL, version: env.DEPTH_MODEL_VERSION, input: { image: imageDataUrl }, label: "DEPTH" });
  } catch (error) { warnings.push(error instanceof Error ? error.message : "Depth provider failed."); }
  const outset = refinement?.maskInsetOutsetPx ?? 0;
  if (outset) warnings.push(`Mask inset/outset requested: ${outset}px. Apply vector offset during rendering/export.`);
  return { surface: fallbackSurface(), masks: normalizeProviderMasks(segmentation), depth: { outputUrl: typeof depth?.output === "string" ? depth.output : Array.isArray(depth?.output) ? depth.output[0] : undefined }, flattenedTemplate: { width: 1920, height: 1080, aspectRatio: "16:9" }, debug: { geometryProvider: env.GEOMETRY_API_URL ? "configured but not yet used" : "not used", segmentationProvider: env.SAM2_API_KEY ? "replicate" : "missing", depthProvider: env.DEPTH_API_KEY ? "replicate" : "missing", warnings } } satisfies ProjectionAnalysis;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as { imageDataUrl?: string; refinement?: { positivePoints?: Point[]; negativePoints?: Point[]; maskInsetOutsetPx?: number } };
    if (!body.imageDataUrl?.startsWith("data:image/")) return json({ error: "imageDataUrl is required as a data:image/* URL." }, 400);
    return json(await analyze(body.imageDataUrl, env, body.refinement));
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Projection analysis failed." }, 500); }
};
