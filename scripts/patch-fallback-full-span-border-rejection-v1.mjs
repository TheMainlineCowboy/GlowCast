import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fullSpanBorderFallback =";
const helperMarker = "function hasDistributedFullSpanPerimeter";
const distinctEvidenceMarker = "new Map<number, Set<number>>()";
const continuousRunMarker = "function hasContinuousPerimeterRun";
const scaledRunMarker = "const requiredRunLength = Math.min(8, Math.max(3, Math.ceil(sectionSpan / 80)))";
const scaledAdjacencyMarker = "const maximumAdjacentGap = Math.min(400, Math.max(150, Math.ceil(sectionSpan / 160) * 100))";
if (
  source.includes(marker) &&
  source.includes(helperMarker) &&
  source.includes(distinctEvidenceMarker) &&
  source.includes(continuousRunMarker) &&
  source.includes(scaledRunMarker) &&
  source.includes(scaledAdjacencyMarker)
) {
  console.log("Full-span fallback border rejection already applied.");
  process.exit(0);
}

const helperAnchor = "function buildFallbackComponents(edgePoints: EdgePoint[], bounds: SimpleBox): FallbackComponent[] {";
const helper = `function hasContinuousPerimeterRun(positions: Set<number>, sectionSpan: number): boolean {
  const sorted = [...positions].sort((a, b) => a - b);
  let longestRun = sorted.length > 0 ? 1 : 0;
  let currentRun = longestRun;

  // Positions are stored at 1/100-pixel precision. Compact openings retain the
  // existing 1.5-pixel adjacency allowance, while larger high-resolution frames
  // can tolerate proportionally wider detector sampling gaps up to four pixels.
  // This avoids splitting a real structural edge without joining distant noise.
  const maximumAdjacentGap = Math.min(400, Math.max(150, Math.ceil(sectionSpan / 160) * 100));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] - sorted[index - 1] <= maximumAdjacentGap) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // Three connected samples are enough for smaller openings, while large or
  // high-resolution perimeter sections must sustain a longer run. This keeps
  // tiny noise clusters from qualifying on detailed photographs without making
  // compact architectural frames impossible to recover.
  const requiredRunLength = Math.min(8, Math.max(3, Math.ceil(sectionSpan / 80)));
  return longestRun >= requiredRunLength;
}

function hasDistributedFullSpanPerimeter(points: EdgePoint[], box: SimpleBox): boolean {
  const tolerance = Math.max(1.2, Math.min(box.width, box.height) * 0.09);
  const sideBuckets = {
    top: new Map<number, Set<number>>(),
    bottom: new Map<number, Set<number>>(),
    left: new Map<number, Set<number>>(),
    right: new Map<number, Set<number>>()
  };

  const addEvidence = (buckets: Map<number, Set<number>>, bucket: number, position: number) => {
    const positions = buckets.get(bucket) ?? new Set<number>();
    positions.add(Math.round(position * 100));
    buckets.set(bucket, positions);
  };

  for (const point of points) {
    if (point.x < box.x - tolerance || point.x > box.x + box.width + tolerance) continue;
    if (point.y < box.y - tolerance || point.y > box.y + box.height + tolerance) continue;

    const xBucket = Math.min(2, Math.max(0, Math.floor(((point.x - box.x) / Math.max(box.width, 0.01)) * 3)));
    const yBucket = Math.min(2, Math.max(0, Math.floor(((point.y - box.y) / Math.max(box.height, 0.01)) * 3)));

    if (Math.abs(point.y - box.y) <= tolerance) addEvidence(sideBuckets.top, xBucket, point.x);
    if (Math.abs(point.y - (box.y + box.height)) <= tolerance) addEvidence(sideBuckets.bottom, xBucket, point.x);
    if (Math.abs(point.x - box.x) <= tolerance) addEvidence(sideBuckets.left, yBucket, point.y);
    if (Math.abs(point.x - (box.x + box.width)) <= tolerance) addEvidence(sideBuckets.right, yBucket, point.y);
  }

  // A perimeter third only counts when it contains a continuous run sized for
  // that architectural section. Large high-resolution openings require more
  // evidence while allowing slightly wider detector sampling gaps than compact frames.
  const horizontalSectionSpan = box.width / 3;
  const verticalSectionSpan = box.height / 3;
  const bucketCounts = [
    [...sideBuckets.top.values()].filter((positions) => hasContinuousPerimeterRun(positions, horizontalSectionSpan)).length,
    [...sideBuckets.bottom.values()].filter((positions) => hasContinuousPerimeterRun(positions, horizontalSectionSpan)).length,
    [...sideBuckets.left.values()].filter((positions) => hasContinuousPerimeterRun(positions, verticalSectionSpan)).length,
    [...sideBuckets.right.values()].filter((positions) => hasContinuousPerimeterRun(positions, verticalSectionSpan)).length
  ];
  const totalBuckets = bucketCounts.reduce((sum, count) => sum + count, 0);

  // A large opening may be locally interrupted by a column, plant, or foreground
  // object. Permit one missing perimeter third, but require every side to retain
  // broad evidence so corner-only facade outlines and crop borders still fail.
  return totalBuckets >= 11 && bucketCounts.every((count) => count >= 2);
}

${helperAnchor}`;

if (!source.includes(helperMarker)) {
  if (!source.includes(helperAnchor)) {
    throw new Error("Full-span perimeter helper anchor not found.");
  }
  source = source.replace(helperAnchor, helper);
} else if (!source.includes(scaledAdjacencyMarker)) {
  const helperPattern = /function hasContinuousPerimeterRun\([\s\S]*?\n\}\n\nfunction hasDistributedFullSpanPerimeter\([\s\S]*?\n\}\n\nfunction buildFallbackComponents/;
  if (!helperPattern.test(source)) {
    throw new Error("Existing full-span perimeter helpers could not be upgraded.");
  }
  source = source.replace(helperPattern, `${helper}\nfunction buildFallbackComponents`);
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
  !source.includes(distinctEvidenceMarker) ||
  !source.includes(continuousRunMarker) ||
  !source.includes(scaledRunMarker) ||
  !source.includes(scaledAdjacencyMarker) ||
  !source.includes("horizontalSectionSpan") ||
  !source.includes("totalBuckets >= 11") ||
  !source.includes("if (fullSpanBorderFallback) continue;")
) {
  throw new Error("Full-span fallback border rejection was not applied.");
}

await fs.writeFile(path, source);
console.log("Rejected weakly distributed full-span border masks using resolution-scaled perimeter runs and adjacency.");