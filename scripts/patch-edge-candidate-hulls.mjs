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
  const holes = findEnclosedHoles(edgePoints, projectionZone)
    .sort((a, b) => b.area - a.area);

  const candidates: { box: ProjectionZone; points: Coordinate[]; score: number }[] = [];
  for (const hole of holes) {
    const rawBox = toPercentBox(hole.box, 260, 260);
    const box = expandBox(rawBox, projectionZone);
    const cx = rawBox.x + rawBox.width / 2;
    const cy = rawBox.y + rawBox.height / 2;
    const grownPoints = hole.points.map((point) => ({
      x: clamp(cx + (point.x - cx) * 1.18, box.x, box.x + box.width),
      y: clamp(cy + (point.y - cy) * 1.18, box.y, box.y + box.height)
    }));
    candidates.push({ box, points: grownPoints.length >= 3 ? grownPoints : pointsForBox(box), score: hole.area * hole.fillRatio });
  }

  const accepted: { box: ProjectionZone; points: Coordinate[] }[] = [];
  for (const candidate of candidates) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing.box, candidate.box);
      const minArea = Math.min(existing.box.width * existing.box.height, candidate.box.width * candidate.box.height);
      return overlap / Math.max(minArea, 0.01) > 0.45;
    });
    if (duplicate) continue;
    accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({
      id: "auto_mask_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points,
      boundingBox: box,
      enabled: true
    }));
}
`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
writeFileSync(path, source);
console.log("edge candidates restored to closed edge hull masks");

await import("./patch-edge-visible-closure.mjs");
await import("./patch-edge-cluster-fallback.mjs");
await import("./patch-final-edge-flow.mjs");
await import("./patch-fix-app-syntax-line1538.mjs");
