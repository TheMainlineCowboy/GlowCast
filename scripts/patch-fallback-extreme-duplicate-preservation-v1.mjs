import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const anchor = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      if (fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;

const enhanced = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      const fallbackAspect = box.width / Math.max(box.height, 0.01);
      const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;
      // A long, thin fallback may be a valid closed fixture, but it should never
      // displace a stronger architectural detector result that already occupies
      // the same region. Preserve the primary mask and discard the duplicate.
      if (!extremeFallbackAspect && fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;

if (source.includes("const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;")) {
  console.log("Extreme-aspect duplicate preservation already present.");
} else if (source.includes(anchor)) {
  source = source.replace(anchor, enhanced);
  await fs.writeFile(path, source);
  console.log("Prevented extreme-aspect fallback duplicates from replacing stronger architectural masks.");
} else {
  throw new Error("Fallback duplicate replacement anchor not found.");
}
