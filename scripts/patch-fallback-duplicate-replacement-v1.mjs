import fs from "node:fs";

const p = "src/core/maskCandidateAdapter.ts";
let s = fs.readFileSync(p, "utf8");

const before = `    const box = { x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height };
    const duplicate = next.some((existing) => overlapRatio(existing.box, box) > 0.58);
    if (duplicate) continue;

    next.push({
      id: "mask_fallback_" + Date.now() + "_" + next.length,
      box,
      points: fallback.points.length >= 3 ? fallback.points : boxPoints(box)
    });`;

const after = `    const box = { x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height };
    const area = box.width * box.height;
    const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);
    if (duplicateIndex >= 0) {
      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      if (area > existingArea * 1.35) {
        next[duplicateIndex] = {
          id: existing.id,
          box,
          points: fallback.points.length >= 3 ? fallback.points : boxPoints(box)
        };
      }
      continue;
    }

    next.push({
      id: "mask_fallback_" + Date.now() + "_" + next.length,
      box,
      points: fallback.points.length >= 3 ? fallback.points : boxPoints(box)
    });`;

if (s.includes("const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);")) {
  console.log("Fallback duplicate replacement patch already applied.");
} else if (s.includes(before)) {
  s = s.replace(before, after);
  fs.writeFileSync(p, s);
  console.log("Applied fallback duplicate replacement patch.");
} else {
  console.warn("Could not find fallback duplicate block. Continuing without duplicate replacement patch.");
}
