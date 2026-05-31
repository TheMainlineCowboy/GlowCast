import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const oldFunction = `function outerTrimExpansionAmount(box: ProjectionZone, projectionZone: ProjectionZone) {
  const objectSize = Math.min(box.width, box.height);
  const wallRelativeMinimum = Math.min(projectionZone.width, projectionZone.height) * 0.018;
  const objectRelative = objectSize * 0.22;
  // The flood-fill finds the inside glass / inside opening. Grow that closed loop outward
  // so the usable mask begins on the outer window trim / object frame instead.
  return Math.max(0.8, wallRelativeMinimum, Math.min(objectRelative, 3.2));
}`;

const newFunction = `function outerTrimExpansionAmount(box: ProjectionZone, projectionZone: ProjectionZone) {
  const objectSize = Math.min(box.width, box.height);
  const wallRelativeMinimum = Math.min(projectionZone.width, projectionZone.height) * 0.034;
  const objectRelative = objectSize * 0.52;
  // Flood-fill gives us the inside enclosed opening. The mask must protect the whole
  // physical object, so grow the filled polygon far enough to land on the OUTER trim/frame.
  // This is intentionally stronger than the first pass because the screenshot proved the
  // polygon conversion is correct, but it was stopping on the inside glass/opening edge.
  return Math.max(1.35, wallRelativeMinimum, Math.min(objectRelative, 6.2));
}`;

if (!source.includes(oldFunction)) {
  throw new Error("Could not find current outer trim expansion function to widen edge masks.");
}

source = source.replace(oldFunction, newFunction);
writeFileSync(path, source);
console.log("edge filled masks now grow to the outer trim/frame instead of inner openings");
