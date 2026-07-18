import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fullSpanBorderFallback =";
const helperMarker = "function hasDistributedFullSpanPerimeter";
if (source.includes(marker) && source.includes(helperMarker)) {
  console.log("Full-span fallback border rejection already applied.");
  process.exit(0);
}

if (!source.includes(helperMarker)) {
  const helperAnchor = "function buildFallbackComponents(edgePoints: EdgePoint[], bounds: SimpleBox): FallbackComponent[] {";
  const helper = `function hasDistributedFullSpanPerimeter(points: EdgePoint[], box: SimpleBox): boolean {
  const tolerance = Math.max(1.2, Math.min(box.width, box.height) * 0.09);
  const sideBuckets = {
    top: new Set<number>(),
    bottom: new Set<number>(),
    left: new Set<number>(),
    right: new Set<number>()
  };

  for (const point of points) {
    if (point.x < box.x - tolerance || point.x > box.x + box.width + tolerance) continue;
    if (point.y < box.y - tolerance || point.y > box.y + box.height + tolerance) continue;

    const xBucket = Math.min(2, Math.max(0, Math.floor(((point.x - box.x) / Math.max(box.width, 0.01)) * 3)));
    const yBucket = Math.min(2, Math.max(0, Math.floor(((point.y - box.y) / Math.max(box.height, 0.01)) * 3)));

    if (Math.abs(point.y - box.y) <= tolerance) sideBuckets.top.add(xBucket);
    if (Math.abs(point.y - (box.y + box.height)) <= tolerance) sideBuckets.bottom.add(xBucket);
    if (Math.abs(point.x - box.x) <= tolerance) sideBuckets.left.add(yBucket);
    if (Math.abs(point.x - (box.x + box.width)) <= tolerance) sideBuckets.right.add(yBucket);
  }

  const bucketCounts = Object.values(sideBuckets).map((buckets) => buckets.size);
  const totalBuckets = bucketCounts.reduce((sum, count) => sum + count, 0);

  // A large opening may be locally interrupted by a column, plant, or foreground
  // object. Permit one missing perimeter third, but require every side to retain
  // broad evidence so corner-only facade outlines and crop borders still fail.
  return totalBuckets >= 11 && bucketCounts.every((count) => count >= 2);
}

${helperAnchor}`;

  if (!source.includes(helperAnchor)) {
    throw new Error("Full-span perimeter helper anchor not found.");
  }
  source = source.replace(helperAnchor, helper);
}

const anchor = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;`;
const replacement = `    if (boundaryTouchingFallback && sideCoverage.sides < 4) continue;
    // Components that span almost an entire photo dimension are only accepted when
    // their perimeter evidence is distributed across nearly every third of every side.
    // One locally interrupted segment is allowed for real-world occlusion, while crop
    // borders and facade outlines concentrated near corners or seams remain rejected.
    const widthSpanRatio = box.width / Math.max(bounds.width, 0.01);
    const heightSpanRatio = box.height / Math.max(bounds.height, 0.01);
    const nearFullSpanFallback = widthSpanRatio >= 0.9 || heightSpanRatio >= 0.9;
    const distributedFullSpanPerimeter = hasDistributedFullSpanPerimeter(componentPoints, box);
    const fullWidthBorderFallback = widthSpanRatio >= 0.9 && heightSpanRatio <= 0.14;
    const fullHeightBorderFallback = heightSpanRatio >= 0.9 && widthSpanRatio <= 0.14;
    const fullSpanBorderFallback =
      fullWidthBorderFallback ||
      fullHeightBorderFallback ||
      (nearFullSpanFallback && !distributedFullSpanPerimeter);
    if (fullSpanBorderFallback) continue;`;

if (!source.includes(marker)) {
  if (!source.includes(anchor)) {
    throw new Error("Full-span fallback rejection anchor not found.");
  }
  source = source.replace(anchor, replacement);
}

if (
  !source.includes(marker) ||
  !source.includes(helperMarker) ||
  !source.includes("totalBuckets >= 11") ||
  !source.includes("if (fullSpanBorderFallback) continue;")
) {
  throw new Error("Full-span fallback border rejection was not applied.");
}

await fs.writeFile(path, source);
console.log("Rejected weakly distributed full-span border masks while allowing one supported perimeter interruption.");
