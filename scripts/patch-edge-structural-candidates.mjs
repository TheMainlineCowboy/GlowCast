import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const start = source.indexOf("export function generateAutoMasks(");
const end = source.indexOf("\nexport function drawProjectionWithMasks(", start);
if (start < 0 || end < 0) throw new Error("Could not find generateAutoMasks block.");

const replacement = String.raw`export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const projectionArea = projectionZone.width * projectionZone.height;
  const points = edgePoints.filter((point) =>
    point.strength >= 70 &&
    point.x >= projectionZone.x && point.x <= projectionZone.x + projectionZone.width &&
    point.y >= projectionZone.y && point.y <= projectionZone.y + projectionZone.height
  );
  const candidates: { box: ProjectionZone; score: number }[] = [];

  const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  const scoreBox = (box: ProjectionZone) => {
    const bandX = Math.max(0.7, box.width * 0.12);
    const bandY = Math.max(0.7, box.height * 0.12);
    const inside = points.filter((p) => p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height);
    if (inside.length < 12) return 0;
    const left = inside.filter((p) => p.x <= box.x + bandX);
    const right = inside.filter((p) => p.x >= box.x + box.width - bandX);
    const top = inside.filter((p) => p.y <= box.y + bandY);
    const bottom = inside.filter((p) => p.y >= box.y + box.height - bandY);
    const leftOk = left.length >= 3 && span(left.map((p) => p.y)) >= box.height * 0.35;
    const rightOk = right.length >= 3 && span(right.map((p) => p.y)) >= box.height * 0.35;
    const topOk = top.length >= 3 && span(top.map((p) => p.x)) >= box.width * 0.35;
    const bottomOk = bottom.length >= 3 && span(bottom.map((p) => p.x)) >= box.width * 0.35;
    const sides = [leftOk, rightOk, topOk, bottomOk].filter(Boolean).length;
    if (sides < 3) return 0;
    const borderCount = left.length + right.length + top.length + bottom.length;
    const interiorCount = inside.length - borderCount;
    const aspect = box.width / Math.max(box.height, 0.01);
    const aspectPenalty = Math.abs(Math.log(aspect));
    return sides * 100 + borderCount * 2 - interiorCount * 0.8 - aspectPenalty * 18;
  };

  const widths = [0.10, 0.14, 0.18, 0.24, 0.32].map((value) => projectionZone.width * value);
  const heights = [0.14, 0.20, 0.28, 0.38, 0.52].map((value) => projectionZone.height * value);
  for (const width of widths) {
    for (const height of heights) {
      const area = width * height;
      const aspect = width / Math.max(height, 0.01);
      if (area < projectionArea * 0.008 || area > projectionArea * 0.22) continue;
      if (aspect < 0.20 || aspect > 4.8) continue;
      const stepX = Math.max(1.8, width * 0.22);
      const stepY = Math.max(1.8, height * 0.22);
      for (let y = projectionZone.y + projectionZone.height * 0.05; y + height <= projectionZone.y + projectionZone.height * 0.95; y += stepY) {
        for (let x = projectionZone.x + projectionZone.width * 0.03; x + width <= projectionZone.x + projectionZone.width * 0.97; x += stepX) {
          const box = { x, y, width, height };
          const score = scoreBox(box);
          if (score > 260) candidates.push({ box: expandBox(box, projectionZone), score });
        }
      }
    }
  }

  const accepted: ProjectionZone[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate.box);
      const minArea = Math.min(existing.width * existing.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.35;
    });
    if (duplicate) continue;
    accepted.push(candidate.box);
    if (accepted.length >= 10) break;
  }

  return accepted
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((box, index) => ({
      id: "auto_mask_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points: pointsForBox(box),
      boundingBox: box,
      enabled: true
    }));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
console.log("edge masks now use border scoring instead of connected blobs");
