import { readFileSync, writeFileSync } from "node:fs";

const edgePath = "src/edgeDetect.ts";
let edge = readFileSync(edgePath, "utf8");

edge = edge.replace(
  'shape: "polygon";',
  'shape: "rectangle" | "circle" | "oval" | "triangle" | "polygon";'
);
edge = edge.replace(
  'const candidates: { box: ProjectionZone; score: number }[] = [];',
  'const candidates: { box: ProjectionZone; score: number; shape: AutoMaskZone["shape"] }[] = [];'
);
edge = edge.replace(
  '  const widths = [0.09, 0.12, 0.16, 0.21, 0.27].map((value) => projectionZone.width * value);',
  `  const distToSegment = (p: Coordinate, a: Coordinate, b: Coordinate) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    const t = c2 <= 0 ? 0 : Math.max(0, Math.min(1, c1 / c2));
    return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
  };

  const scoreCircle = (box: ProjectionZone) => {
    const aspect = box.width / Math.max(box.height, 0.01);
    if (aspect < 0.72 || aspect > 1.38) return 0;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) / 2;
    const tolerance = Math.max(0.8, r * 0.20);
    const bins = new Set<number>();
    let ring = 0;
    for (const p of points) {
      if (p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height) continue;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (Math.abs(d - r) > tolerance) continue;
      ring += 1;
      const angle = Math.atan2(p.y - cy, p.x - cx) + Math.PI;
      bins.add(Math.floor((angle / (Math.PI * 2)) * 12));
    }
    if (ring < 16 || bins.size < 7) return 0;
    return bins.size * 52 + ring * 2.2;
  };

  const scoreTriangle = (box: ProjectionZone) => {
    const top = { x: box.x + box.width / 2, y: box.y };
    const left = { x: box.x, y: box.y + box.height };
    const right = { x: box.x + box.width, y: box.y + box.height };
    const tolerance = Math.max(0.75, Math.min(box.width, box.height) * 0.10);
    let a = 0, b = 0, c = 0;
    for (const p of points) {
      if (p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height) continue;
      if (distToSegment(p, top, left) <= tolerance) a += 1;
      if (distToSegment(p, top, right) <= tolerance) b += 1;
      if (distToSegment(p, left, right) <= tolerance) c += 1;
    }
    const sides = [a >= 5, b >= 5, c >= 5].filter(Boolean).length;
    if (sides < 2 || a + b + c < 18) return 0;
    return sides * 120 + (a + b + c) * 2;
  };

  const widths = [0.09, 0.12, 0.16, 0.21, 0.27].map((value) => projectionZone.width * value);`
);
edge = edge.replace(
  `          const score = scoreBox(box);
          if (score > 345) candidates.push({ box: expandBox(box, projectionZone), score });`,
  `          const rectScore = scoreBox(box);
          const circleScore = scoreCircle(box);
          const triangleScore = scoreTriangle(box);
          let shape: AutoMaskZone["shape"] = "rectangle";
          let score = rectScore;
          if (circleScore > score + 25) { shape = "circle"; score = circleScore; }
          if (triangleScore > score + 25) { shape = "triangle"; score = triangleScore; }
          if (score > 345) candidates.push({ box: expandBox(box, projectionZone), score, shape });`
);
edge = edge.replace('const accepted: ProjectionZone[] = [];', 'const accepted: { box: ProjectionZone; shape: AutoMaskZone["shape"] }[] = [];');
edge = edge.replaceAll('overlapAmount(existing, candidate.box)', 'overlapAmount(existing.box, candidate.box)');
edge = edge.replaceAll('existing.width * existing.height', 'existing.box.width * existing.box.height');
edge = edge.replace('accepted.push(candidate.box);', 'accepted.push({ box: candidate.box, shape: candidate.shape });');
edge = edge.replace(
  `.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    .map((box, index) => ({`,
  `.sort((a, b) => a.box.y === b.box.y ? a.box.x - b.box.x : a.box.y - b.box.y)
    .map(({ box, shape }, index) => ({`
);
edge = edge.replace('shape: "polygon",\n      points: pointsForBox(box),', 'shape,\n      points: shape === "polygon" ? pointsForBox(box) : [],');

writeFileSync(edgePath, edge);

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");
app = app.replace(
  `    const relativePoints = mask.points.map((point) => ({
      x: Number(clamp(((point.x - box.x) / Math.max(box.width, 0.01)) * 100).toFixed(2)),
      y: Number(clamp(((point.y - box.y) / Math.max(box.height, 0.01)) * 100).toFixed(2))
    }));`,
  `    const shape = mask.shape === "polygon" ? "freehand" : mask.shape;
    const relativePoints = mask.points.map((point) => ({
      x: Number(clamp(((point.x - box.x) / Math.max(box.width, 0.01)) * 100).toFixed(2)),
      y: Number(clamp(((point.y - box.y) / Math.max(box.height, 0.01)) * 100).toFixed(2))
    }));`
);
app = app.replace('      shape: "freehand",\n      points: relativePoints.length >= 3 ? relativePoints : undefined', '      shape: shape as MaskShape,\n      points: shape === "freehand" && relativePoints.length >= 3 ? relativePoints : undefined');
writeFileSync(appPath, app);

console.log("auto masks now preserve rectangle, circle, and triangle shapes");
