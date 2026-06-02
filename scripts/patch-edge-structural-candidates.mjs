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
    point.strength >= 72 &&
    point.x >= projectionZone.x + projectionZone.width * 0.035 && point.x <= projectionZone.x + projectionZone.width * 0.965 &&
    point.y >= projectionZone.y + projectionZone.height * 0.055 && point.y <= projectionZone.y + projectionZone.height * 0.935
  );
  const candidates: { box: ProjectionZone; score: number }[] = [];

  const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  const scoreBox = (box: ProjectionZone) => {
    const bandX = Math.max(0.65, box.width * 0.10);
    const bandY = Math.max(0.65, box.height * 0.10);
    const inside = points.filter((p) => p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height);
    if (inside.length < 14) return 0;
    const left = inside.filter((p) => p.x <= box.x + bandX);
    const right = inside.filter((p) => p.x >= box.x + box.width - bandX);
    const top = inside.filter((p) => p.y <= box.y + bandY);
    const bottom = inside.filter((p) => p.y >= box.y + box.height - bandY);
    const leftSpan = span(left.map((p) => p.y));
    const rightSpan = span(right.map((p) => p.y));
    const topSpan = span(top.map((p) => p.x));
    const bottomSpan = span(bottom.map((p) => p.x));
    const leftOk = left.length >= 4 && leftSpan >= box.height * 0.42;
    const rightOk = right.length >= 4 && rightSpan >= box.height * 0.42;
    const topOk = top.length >= 4 && topSpan >= box.width * 0.42;
    const bottomOk = bottom.length >= 4 && bottomSpan >= box.width * 0.42;
    const sides = [leftOk, rightOk, topOk, bottomOk].filter(Boolean).length;
    if (sides < 3) return 0;
    const borderCount = left.length + right.length + top.length + bottom.length;
    const interiorCount = Math.max(0, inside.length - borderCount);
    const aspect = box.width / Math.max(box.height, 0.01);
    const aspectPenalty = Math.abs(Math.log(aspect));
    const sizePenalty = (box.width * box.height / projectionArea) * 85;
    const balancePenalty = Math.abs(left.length - right.length) + Math.abs(top.length - bottom.length);
    return sides * 125 + borderCount * 2.4 - interiorCount * 1.1 - aspectPenalty * 20 - sizePenalty - balancePenalty * 0.45;
  };

  const widths = [0.09, 0.12, 0.16, 0.21, 0.27].map((value) => projectionZone.width * value);
  const heights = [0.12, 0.17, 0.23, 0.31, 0.42].map((value) => projectionZone.height * value);
  for (const width of widths) {
    for (const height of heights) {
      const area = width * height;
      const aspect = width / Math.max(height, 0.01);
      if (area < projectionArea * 0.010 || area > projectionArea * 0.14) continue;
      if (aspect < 0.25 || aspect > 4.1) continue;
      const stepX = Math.max(1.25, width * 0.16);
      const stepY = Math.max(1.25, height * 0.16);
      for (let y = projectionZone.y + projectionZone.height * 0.08; y + height <= projectionZone.y + projectionZone.height * 0.92; y += stepY) {
        for (let x = projectionZone.x + projectionZone.width * 0.055; x + width <= projectionZone.x + projectionZone.width * 0.945; x += stepX) {
          const box = { x, y, width, height };
          const score = scoreBox(box);
          if (score > 345) candidates.push({ box: expandBox(box, projectionZone), score });
        }
      }
    }
  }

  const accepted: ProjectionZone[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate.box);
      const minArea = Math.min(existing.width * existing.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.26;
    });
    if (duplicate) continue;
    accepted.push(candidate.box);
    if (accepted.length >= 5) break;
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
console.log("edge masks now use tighter border scoring with fewer overlaps");
