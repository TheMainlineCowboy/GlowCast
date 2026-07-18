import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const boundaryTouchingFallback =";
if (source.includes(marker)) {
  console.log("Boundary-touching fallback closure gate already applied.");
  process.exit(0);
}

const anchor = `    // Fallback masks should represent a mostly closed architectural feature, not
    // a random L-shaped edge fragment. Three sides preserves doorway/arch recovery
    // while rejecting two-sided corner noise.
    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;`;

const replacement = `    // Fallback masks should represent a mostly closed architectural feature, not
    // a random L-shaped edge fragment. Three sides preserves doorway/arch recovery
    // while rejecting two-sided corner noise.
    const boundaryTolerance = Math.max(cellSize * 1.5, Math.min(bounds.width, bounds.height) * 0.012);
    const boundaryTouchingFallback =
      box.x <= bounds.x + boundaryTolerance ||
      box.y <= bounds.y + boundaryTolerance ||
      box.x + box.width >= bounds.x + bounds.width - boundaryTolerance ||
      box.y + box.height >= bounds.y + bounds.height - boundaryTolerance;
    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;
    // Cropped image edges often look like a missing side. Do not auto-mask those
    // ambiguous fragments unless the opening has direct evidence on all four sides.
    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;`;

if (!source.includes(anchor)) {
  throw new Error("Fallback boundary-closure anchor not found.");
}

source = source.replace(anchor, replacement);
if (!source.includes(marker) || !source.includes("boundaryTouchingFallback && sideCoverage.sides < 4")) {
  throw new Error("Boundary-touching fallback closure gate was not applied.");
}

await fs.writeFile(path, source);
console.log("Required full closure for fallback masks touching the projection boundary.");
