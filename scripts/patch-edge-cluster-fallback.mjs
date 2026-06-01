import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const marker = "function pointsForBox(box: ProjectionZone): Coordinate[] {";
if (!source.includes("function fallbackClusterMasks(")) {
  source = source.replace(marker, `function fallbackClusterMasks(edgePoints: EdgePoint[], projectionZone: ProjectionZone): AutoMaskZone[] {
  const points = edgePoints.filter((point) =>
    point.strength >= 90 &&
    point.x >= projectionZone.x && point.x <= projectionZone.x + projectionZone.width &&
    point.y >= projectionZone.y && point.y <= projectionZone.y + projectionZone.height
  );

  const cellSize = 3.2;
  const buckets = new Map<string, EdgePoint[]>();
  for (const point of points) {
    const key = Math.floor(point.x / cellSize) + ":" + Math.floor(point.y / cellSize);
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }

  const boxes = [...buckets.values()]
    .filter((bucket) => bucket.length >= 10)
    .map((bucket) => {
      const xs = bucket.map((point) => point.x);
      const ys = bucket.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      };
    })
    .filter((box) => box.width >= 1.2 && box.height >= 1.2)
    .filter((box) => box.width * box.height <= projectionZone.width * projectionZone.height * 0.18)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const accepted: ProjectionZone[] = [];
  for (const box of boxes) {
    const expanded = expandBox(box, projectionZone);
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, expanded);
      const minArea = Math.min(existing.width * existing.height, expanded.width * expanded.height);
      return overlap / Math.max(minArea, 0.01) > 0.35;
    });
    if (duplicate) continue;
    accepted.push(expanded);
    if (accepted.length >= 8) break;
  }

  return accepted
    .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((box, index) => ({
      id: "auto_mask_fallback_" + Date.now() + "_" + index,
      type: "auto-generated",
      shape: "polygon",
      points: pointsForBox(box),
      boundingBox: box,
      enabled: true
    }));
}

${marker}`);
}

const returnAnchor = `  return accepted
    .sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, points }, index) => ({`;

if (!source.includes("if (accepted.length === 0) return fallbackClusterMasks(edgePoints, projectionZone);")) {
  source = source.replace(returnAnchor, `  if (accepted.length === 0) return fallbackClusterMasks(edgePoints, projectionZone);

${returnAnchor}`);
}

writeFileSync(path, source);
console.log("added edge cluster fallback when closed-hole masks are not found");
