import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const centerConsistentFallback = normalizedCenterDrift <= 0.22;";
if (source.includes(marker)) {
  console.log("Fallback duplicate center-drift gate already applied.");
  process.exit(0);
}

const anchor = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      if (fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;
const replacement = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      const fallbackAspect = box.width / Math.max(box.height, 0.01);
      const existingAspect = existing.box.width / Math.max(existing.box.height, 0.01);
      const aspectChange = Math.max(fallbackAspect / existingAspect, existingAspect / fallbackAspect);
      const existingCenterX = existing.box.x + existing.box.width / 2;
      const existingCenterY = existing.box.y + existing.box.height / 2;
      const fallbackCenterX = box.x + box.width / 2;
      const fallbackCenterY = box.y + box.height / 2;
      const normalizedCenterDrift = Math.hypot(
        (fallbackCenterX - existingCenterX) / Math.max(existing.box.width, 0.01),
        (fallbackCenterY - existingCenterY) / Math.max(existing.box.height, 0.01)
      );
      const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;
      const shapeConsistentFallback = aspectChange <= 1.6;
      const centerConsistentFallback = normalizedCenterDrift <= 0.22;
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&
        fallbackArea > existingArea * 1.12 &&
        fallback.score >= 1.2
      ) {`;

if (!source.includes(anchor)) {
  throw new Error("Fallback duplicate replacement anchor not found.");
}

source = source.replace(anchor, replacement);

if (!source.includes(marker) || !source.includes("centerConsistentFallback &&")) {
  throw new Error("Fallback duplicate center-drift gate was not applied.");
}

await fs.writeFile(path, source);
console.log("Prevented displaced fallback duplicates from replacing stronger architectural masks.");
