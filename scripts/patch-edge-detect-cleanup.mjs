import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

if (!source.includes("function buildDensityCandidates(")) {
  source = source.replace(
    "export function generateAutoMasks(\n",
    `function buildDensityCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  const points = edgePoints.filter((point) => pointInsideBox(point, projectionZone) && point.strength >= 58);
  if (points.length < 20) return [];

  const sizes = [0.12, 0.16, 0.20, 0.24];
  const proposals: ComponentBox[] = [];

  for (const size of sizes) {
    const w = projectionZone.width * size;
    const h = projectionZone.height * Math.min(0.36, size * 1.45);
    const stepX = Math.max(1.2, w * 0.32);
    const stepY = Math.max(1.2, h * 0.32);

    for (let y = projectionZone.y; y <= projectionZone.y + projectionZone.height - h; y += stepY) {
      for (let x = projectionZone.x; x <= projectionZone.x + projectionZone.width - w; x += stepX) {
        let count = 0;
        let strong = 0;
        for (const point of points) {
          if (point.x < x || point.x > x + w || point.y < y || point.y > y + h) continue;
          count += 1;
          if (point.strength >= 92) strong += 1;
        }
        const area = w * h;
        const score = count / Math.sqrt(Math.max(area, 1)) + strong * 0.2;
        if (count < 16 || strong < 3) continue;
        if (area < projectionArea * 0.006 || area > projectionArea * 0.09) continue;
        if (score < 8.5) continue;
        const box = clampToProjection(paddedBox({ x, y, width: w, height: h }, w * 0.08, h * 0.08), projectionZone);
        proposals.push({ ...box, cells: count, edgeCount: count, score });
      }
    }
  }

  const accepted: ComponentBox[] = [];
  for (const candidate of proposals.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.35;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 8) break;
  }
  return accepted;
}

function mergeCandidateBoxes(boxes: ComponentBox[]): ComponentBox[] {
  const accepted: ComponentBox[] = [];
  for (const candidate of boxes.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.42;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }
  return accepted;
}

export function generateAutoMasks(\n`
  );
}

source = source.replace(
  "  const candidates = buildWindowCandidates(edgePoints, projectionZone);\n  return candidates.map((box, index) => ({",
  "  const candidates = mergeCandidateBoxes([...buildWindowCandidates(edgePoints, projectionZone), ...buildDensityCandidates(edgePoints, projectionZone)]);\n  return candidates.map((box, index) => ({"
);

writeFileSync(path, source);
console.log("edge detector adds density candidate pass");
