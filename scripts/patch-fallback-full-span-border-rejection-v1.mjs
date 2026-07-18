import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fullSpanFallback =";
if (source.includes(marker)) {
  console.log("Full-span fallback border rejection already applied.");
  process.exit(0);
}

const anchor = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;`;
const replacement = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;
    // A component spanning almost the entire photo dimension is usually the image,
    // wall, or facade border rather than a projectable architectural opening. Even
    // a closed outline should not become a giant automatic mask in that case.
    const widthSpanRatio = box.width / Math.max(bounds.width, 0.01);
    const heightSpanRatio = box.height / Math.max(bounds.height, 0.01);
    const fullSpanFallback = widthSpanRatio >= 0.9 || heightSpanRatio >= 0.9;
    if (fullSpanFallback) continue;`;

if (!source.includes(anchor)) {
  throw new Error("Full-span fallback rejection anchor not found.");
}

source = source.replace(anchor, replacement);
if (!source.includes(marker) || !source.includes("if (fullSpanFallback) continue;")) {
  throw new Error("Full-span fallback border rejection was not applied.");
}

await fs.writeFile(path, source);
console.log("Rejected fallback masks spanning nearly the full projection boundary.");
