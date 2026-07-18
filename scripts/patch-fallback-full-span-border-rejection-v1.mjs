import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fullSpanBorderFallback =";
if (source.includes(marker)) {
  console.log("Full-span fallback border rejection already applied.");
  process.exit(0);
}

const anchor = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;`;
const replacement = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;
    // Components that span almost an entire photo dimension are only rejected when
    // their cross-dimension is also narrow. This keeps wall/facade borders out while
    // preserving genuinely large closed doors, storefronts, and architectural bays.
    const widthSpanRatio = box.width / Math.max(bounds.width, 0.01);
    const heightSpanRatio = box.height / Math.max(bounds.height, 0.01);
    const fullWidthBorderFallback = widthSpanRatio >= 0.9 && heightSpanRatio <= 0.14;
    const fullHeightBorderFallback = heightSpanRatio >= 0.9 && widthSpanRatio <= 0.14;
    const fullSpanBorderFallback = fullWidthBorderFallback || fullHeightBorderFallback;
    if (fullSpanBorderFallback) continue;`;

if (!source.includes(anchor)) {
  throw new Error("Full-span fallback rejection anchor not found.");
}

source = source.replace(anchor, replacement);
if (!source.includes(marker) || !source.includes("if (fullSpanBorderFallback) continue;")) {
  throw new Error("Full-span fallback border rejection was not applied.");
}

await fs.writeFile(path, source);
console.log("Rejected narrow full-span border masks while preserving large closed openings.");
