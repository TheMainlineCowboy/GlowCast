import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

source = source.replace(
  "type ComponentBox = ProjectionZone & { score: number; edgeCount: number; cells: number };",
  "type DetectedMaskShape = \"rectangle\" | \"circle\" | \"oval\" | \"triangle\";\ntype ComponentBox = ProjectionZone & { score: number; edgeCount: number; cells: number; detectedShape?: DetectedMaskShape };"
);

source = source.replace(
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  enabled: boolean;",
  "  boundingBox: { x: number; y: number; width: number; height: number };\n  detectedShape?: DetectedMaskShape;\n  enabled: boolean;"
);

const helperAnchor = "export function generateAutoMasks(";
const helperBlock = `function ellipsePoints(box: ProjectionZone, steps = 28): Coordinate[] {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2;
  const ry = box.height / 2;
  return Array.from({ length: steps }, (_, i) => {
    const angle = (Math.PI * 2 * i) / steps;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function trianglePoints(box: ProjectionZone): Coordinate[] {
  return [
    { x: box.x + box.width / 2, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
}

function maskPointsForShape(box: ProjectionZone, shape: DetectedMaskShape): Coordinate[] {
  if (shape === "circle" || shape === "oval") return ellipsePoints(box, 32);
  if (shape === "triangle") return trianglePoints(box);
  return rectPoints(box);
}

function makeEdgeGrid(edgePoints: EdgePoint[], projectionZone: ProjectionZone, cellSize = 1) {
  const occupied = new Set<string>();
  const strengths = edgePoints.map((point) => point.strength).sort((a, b) => a - b);
  const threshold = Math.max(52, strengths[Math.floor(strengths.length * 0.34)] ?? 52);
  for (const point of edgePoints) {
    if (point.strength < threshold || !pointInsideBox(point, projectionZone)) continue;
    occupied.add(\`\${Math.floor(point.x / cellSize)},\${Math.floor(point.y / cellSize)}\`);
  }
  const hasHit = (x: number, y: number, radius = 1) => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    for (let ox = -radius; ox <= radius; ox += 1) {
      for (let oy = -radius; oy <= radius; oy += 1) {
        if (occupied.has(\`\${cx + ox},\${cy + oy}\`)) return true;
      }
    }
    return false;
  };
  return { hasHit };
}

function sampledLineHits(a: Coordinate, b: Coordinate, samples: number, hasHit: (x: number, y: number, radius?: number) => boolean) {
  let hits = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = samples <= 1 ? 0 : i / (samples - 1);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (hasHit(x, y, 1)) hits += 1;
  }
  return hits / Math.max(1, samples);
}

function scoreShapeOutline(box: ProjectionZone, shape: DetectedMaskShape, hasHit: (x: number, y: number, radius?: number) => boolean) {
  if (shape === "triangle") {
    const points = trianglePoints(box);
    return (
      sampledLineHits(points[0], points[1], 20, hasHit) +
      sampledLineHits(points[1], points[2], 20, hasHit) +
      sampledLineHits(points[2], points[0], 20, hasHit)
    ) / 3;
  }

  if (shape === "circle" || shape === "oval") {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const rx = box.width / 2;
    const ry = box.height / 2;
    let hits = 0;
    const samples = 52;
    for (let i = 0; i < samples; i += 1) {
      const angle = (Math.PI * 2 * i) / samples;
      if (hasHit(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, 1)) hits += 1;
    }
    return hits / samples;
  }

  const points = rectPoints(box);
  return (
    sampledLineHits(points[0], points[1], 18, hasHit) +
    sampledLineHits(points[1], points[2], 18, hasHit) +
    sampledLineHits(points[2], points[3], 18, hasHit) +
    sampledLineHits(points[3], points[0], 18, hasHit)
  ) / 4;
}

function templateShapeCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  const { hasHit } = makeEdgeGrid(edgePoints, projectionZone, 1);
  const proposals: ComponentBox[] = [];
  const projectionArea = projectionZone.width * projectionZone.height;
  const shapes: DetectedMaskShape[] = ["circle", "oval", "triangle"];

  for (const shape of shapes) {
    const widths = [0.10, 0.13, 0.16, 0.19, 0.22, 0.26, 0.30].map((scale) => projectionZone.width * scale);
    for (const w of widths) {
      const heights = shape === "circle" ? [w] : shape === "triangle" ? [w * 0.75, w * 0.95, w * 1.15] : [w * 0.62, w * 0.82, w * 1.08];
      for (const h of heights) {
        if (w < 5 || h < 5) continue;
        const area = w * h;
        if (area < projectionArea * 0.004 || area > projectionArea * 0.12) continue;
        const stepX = Math.max(1.0, w * 0.12);
        const stepY = Math.max(1.0, h * 0.12);
        for (let y = projectionZone.y; y <= projectionZone.y + projectionZone.height - h; y += stepY) {
          for (let x = projectionZone.x; x <= projectionZone.x + projectionZone.width - w; x += stepX) {
            const box = clampToProjection({ x, y, width: w, height: h }, projectionZone);
            const score = scoreShapeOutline(box, shape, hasHit);
            if (score < (shape === "triangle" ? 0.24 : 0.26)) continue;
            proposals.push({ ...box, cells: 0, edgeCount: 0, score: score * 16 + 2, detectedShape: shape });
          }
        }
      }
    }
  }

  return proposals;
}

function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {
  const accepted: ComponentBox[] = [];
  for (const candidate of boxes.sort((a, b) => {
    const aShape = a.detectedShape && a.detectedShape !== "rectangle" ? 2 : 0;
    const bShape = b.detectedShape && b.detectedShape !== "rectangle" ? 2 : 0;
    return (b.score + bShape) - (a.score + aShape);
  })) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      const overlapRatio = overlap / Math.max(minArea, 1);
      if (overlapRatio <= 0.48) return false;
      if (existing.detectedShape !== candidate.detectedShape && existing.detectedShape !== "rectangle" && candidate.detectedShape !== "rectangle") return false;
      return true;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }
  return accepted;
}

function classifyBoxShape(box: ProjectionZone): DetectedMaskShape {
  const aspect = box.width / Math.max(box.height, 0.01);
  if (aspect > 0.82 && aspect < 1.18) return "circle";
  if (aspect >= 1.18 && aspect < 1.9) return "oval";
  return "rectangle";
}

`;

if (!source.includes("function templateShapeCandidates(")) {
  if (!source.includes(helperAnchor)) throw new Error("Edge cleanup patch failed: generateAutoMasks anchor not found.");
  source = source.replace(helperAnchor, helperBlock + helperAnchor);
}

const generateStart = source.indexOf("export function generateAutoMasks(");
const drawStart = source.indexOf("export function drawProjectionWithMasks(", generateStart);
if (generateStart === -1 || drawStart === -1) throw new Error("Edge cleanup patch failed: generateAutoMasks block not found.");

const generateBlock = `export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const requestedShape = _options.preferredShape ?? "auto";
  const projectionArea = projectionZone.width * projectionZone.height;
  const rectangleCandidates = buildWindowCandidates(edgePoints, projectionZone)
    .filter((box) => {
      const area = box.width * box.height;
      return requestedShape === "rectangle" || area <= projectionArea * 0.18;
    })
    .map((box) => ({
      ...box,
      detectedShape: requestedShape === "rectangle" ? "rectangle" as DetectedMaskShape : classifyBoxShape(box)
    }));
  const shapeCandidates = requestedShape === "rectangle" ? [] : templateShapeCandidates(edgePoints, projectionZone)
    .filter((box) => requestedShape === "auto" || box.detectedShape === requestedShape);
  const candidates = mergeCandidateBoxes([...shapeCandidates, ...rectangleCandidates]);

  return candidates.map((box, index) => {
    const detectedShape = box.detectedShape ?? "rectangle";
    return {
      id: \`auto_mask_\${Date.now()}_\${index}\`,
      type: "auto-generated",
      shape: "polygon",
      points: maskPointsForShape(box, detectedShape).map((point) => ({
        x: Number(point.x.toFixed(2)),
        y: Number(point.y.toFixed(2))
      })),
      boundingBox: {
        x: Number(box.x.toFixed(2)),
        y: Number(box.y.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2))
      },
      detectedShape,
      enabled: true
    };
  });
}

`;

source = source.slice(0, generateStart) + generateBlock + source.slice(drawStart);

writeFileSync(path, source);
console.log("edge detector prevents rectangle candidates from swallowing shape masks");
