type Env = {
  GEOMETRY_API_URL?: string;
  GEOMETRY_API_KEY?: string;
  SAM2_API_URL?: string;
  SAM2_API_KEY?: string;
  DEPTH_API_URL?: string;
  DEPTH_API_KEY?: string;
};

type Point = { x: number; y: number };
type Polygon = Point[];
type ProjectionMask = {
  id: string;
  label: string;
  confidence: number;
  polygon: Polygon;
  svgPath: string;
  depthRole?: "recessed" | "protruding" | "surface";
};

type ProjectionAnalysis = {
  surface: {
    polygon: Polygon;
    svgPath: string;
    homography?: number[];
    depthPlane?: { mean: number; tolerance: number };
  };
  masks: ProjectionMask[];
  flattenedTemplate: {
    width: number;
    height: number;
    aspectRatio: "16:9";
  };
  debug: {
    geometryProvider: string;
    segmentationProvider: string;
    depthProvider: string;
    warnings: string[];
  };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: { "Content-Type": "application/json" }
});

function polygonToSvgPath(points: Polygon) {
  if (!points.length) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} Z`;
}

async function callProvider(url: string | undefined, key: string | undefined, payload: unknown, providerName: string) {
  if (!url) return { provider: providerName, skipped: true, reason: `${providerName} URL is not configured.` };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${providerName} failed: ${response.status} ${text}`);
  }

  return response.json();
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

function normalizeProviderMasks(raw: any): ProjectionMask[] {
  const masks = raw?.masks ?? raw?.segments ?? raw?.polygons ?? [];
  if (!Array.isArray(masks)) return [];

  return masks
    .map((mask: any, index: number) => {
      const polygon = (mask.polygon ?? mask.points ?? []) as Polygon;
      if (!Array.isArray(polygon) || polygon.length < 3) return null;
      return {
        id: String(mask.id ?? `mask-${index + 1}`),
        label: String(mask.label ?? "architectural opening"),
        confidence: Number(mask.confidence ?? 0.75),
        polygon,
        svgPath: mask.svgPath ?? polygonToSvgPath(polygon),
        depthRole: mask.depthRole
      } satisfies ProjectionMask;
    })
    .filter(Boolean) as ProjectionMask[];
}

function mergeDepthRoles(masks: ProjectionMask[], depthResult: any) {
  const depthMasks = normalizeProviderMasks(depthResult);
  if (!depthMasks.length) return masks;

  return masks.map((mask) => {
    const match = depthMasks.find((candidate) => candidate.label === mask.label || candidate.id === mask.id);
    return match ? { ...mask, depthRole: match.depthRole ?? mask.depthRole, confidence: Math.max(mask.confidence, match.confidence) } : mask;
  });
}

async function analyze(imageDataUrl: string, env: Env, refinement?: { positivePoints?: Point[]; negativePoints?: Point[]; maskInsetOutsetPx?: number }) {
  const warnings: string[] = [];

  const geometryPayload = {
    image: imageDataUrl,
    task: "detect architectural vertical and horizontal lines, vanishing points, and homography warp",
    output: "homography_matrix_and_flattened_wall_polygon"
  };

  const segmentationPayload = {
    image: imageDataUrl,
    model: "sam2",
    prompt: "Segment architectural openings: window glass, door frames, glass panels, lights, vents, and protruding fixtures. Return binary masks as polygons, not bounding boxes.",
    positivePoints: refinement?.positivePoints ?? [],
    negativePoints: refinement?.negativePoints ?? [],
    output: "polygons_and_alpha_masks"
  };

  const depthPayload = {
    image: imageDataUrl,
    model: "depth-anything-v2-or-midas",
    task: "find largest continuous wall-depth plane and propose recessed or protruding avoid masks",
    output: "depth_map_surface_plane_and_polygons"
  };

  let geometry: any = null;
  let segmentation: any = null;
  let depth: any = null;

  try { geometry = await callProvider(env.GEOMETRY_API_URL, env.GEOMETRY_API_KEY, geometryPayload, "geometry"); }
  catch (error) { warnings.push(error instanceof Error ? error.message : "Geometry provider failed."); }

  try { segmentation = await callProvider(env.SAM2_API_URL, env.SAM2_API_KEY, segmentationPayload, "sam2"); }
  catch (error) { warnings.push(error instanceof Error ? error.message : "SAM 2 provider failed."); }

  try { depth = await callProvider(env.DEPTH_API_URL, env.DEPTH_API_KEY, depthPayload, "depth"); }
  catch (error) { warnings.push(error instanceof Error ? error.message : "Depth provider failed."); }

  const surfacePolygon = geometry?.surfacePolygon ?? depth?.surfacePolygon ?? null;
  const surface = surfacePolygon?.length >= 3
    ? { polygon: surfacePolygon, svgPath: polygonToSvgPath(surfacePolygon), homography: geometry?.homography, depthPlane: depth?.surfacePlane }
    : fallbackSurface();

  const masks = mergeDepthRoles(normalizeProviderMasks(segmentation), depth);
  const outset = refinement?.maskInsetOutsetPx ?? 0;
  if (outset) warnings.push(`Mask inset/outset requested: ${outset}px. Vector offset should be applied by the renderer/export worker.`);

  return {
    surface,
    masks,
    flattenedTemplate: { width: 1920, height: 1080, aspectRatio: "16:9" },
    debug: {
      geometryProvider: env.GEOMETRY_API_URL ? "configured" : "missing",
      segmentationProvider: env.SAM2_API_URL ? "configured" : "missing",
      depthProvider: env.DEPTH_API_URL ? "configured" : "missing",
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
