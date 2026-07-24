import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const startMarker = "function recoverSparseBridgeComponents(";
const endMarker = "\nfunction buildFallbackComponents(";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  throw new Error("Unable to locate sparse-bridge recovery function");
}

const replacement = `function findSparseBridgeSplit(points: EdgePoint[], box: SimpleBox, bounds: SimpleBox): { horizontal: boolean; position: number } | null {
  const boxArea = box.width * box.height;
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const horizontal = box.width >= box.height;
  const majorSpan = horizontal ? box.width : box.height;
  const boundsSpan = horizontal ? bounds.width : bounds.height;
  if (boxArea < boundsArea * 0.06 || majorSpan < boundsSpan * 0.32) return null;

  const binCount = 9;
  const bins = Array.from({ length: binCount }, () => new Set<string>());
  for (const point of points) {
    const position = horizontal
      ? (point.x - box.x) / Math.max(box.width, 0.01)
      : (point.y - box.y) / Math.max(box.height, 0.01);
    if (position < 0 || position > 1) continue;
    const bucket = Math.min(binCount - 1, Math.floor(position * binCount));
    bins[bucket].add(String(Math.round(point.x)) + "," + String(Math.round(point.y)));
  }

  const counts = bins.map((bin) => bin.size);
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 2; index <= binCount - 3; index += 1) {
    const leftCounts = counts.slice(0, index);
    const rightCounts = counts.slice(index + 1);
    const leftSupport = leftCounts.reduce((sum, count) => sum + count, 0);
    const rightSupport = rightCounts.reduce((sum, count) => sum + count, 0);
    const leftPeak = Math.max(...leftCounts);
    const rightPeak = Math.max(...rightCounts);
    const structuralFloor = Math.min(leftPeak, rightPeak);
    if (leftSupport < 24 || rightSupport < 24 || structuralFloor < 8) continue;

    const sparseLimit = Math.max(4, structuralFloor * 0.34);
    if (counts[index] > sparseLimit) continue;

    const supportBalance = Math.abs(leftSupport - rightSupport) / Math.max(leftSupport + rightSupport, 1);
    const sparsity = counts[index] / Math.max(structuralFloor, 1);
    const score = sparsity + supportBalance * 0.22;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex < 0) return null;
  return { horizontal, position: (bestIndex + 0.5) / binCount };
}

function recoverSparseBridgeComponents(points: EdgePoint[], box: SimpleBox, bounds: SimpleBox): FallbackComponent[] {
  const split = findSparseBridgeSplit(points, box, bounds);
  if (!split) return [];

  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const recoveryGap = 0.12;
  const groups = [
    points.filter((point) => {
      const position = split.horizontal
        ? (point.x - box.x) / Math.max(box.width, 0.01)
        : (point.y - box.y) / Math.max(box.height, 0.01);
      return position <= split.position - recoveryGap;
    }),
    points.filter((point) => {
      const position = split.horizontal
        ? (point.x - box.x) / Math.max(box.width, 0.01)
        : (point.y - box.y) / Math.max(box.height, 0.01);
      return position >= split.position + recoveryGap;
    })
  ];

  const recovered: FallbackComponent[] = [];
  for (const group of groups) {
    if (group.length < 24) return [];

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of group) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const recoveredBox = clampBox(
      { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) },
      bounds
    );
    const area = recoveredBox.width * recoveredBox.height;
    if (
      recoveredBox.width < Math.max(5, bounds.width * 0.055) ||
      recoveredBox.height < Math.max(5, bounds.height * 0.055) ||
      area < boundsArea * 0.008
    ) return [];

    const sideCoverage = getFallbackSideCoverage(group, recoveredBox);
    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) return [];

    const densityScore = group.length / Math.max(area, 1);
    recovered.push({
      ...recoveredBox,
      cells: group.length,
      edgeCount: group.length,
      points: buildOutlineFromPoints(group, recoveredBox),
      score: densityScore + sideCoverage.sides * 0.22 + 0.75
    });
  }

  const separation = split.horizontal
    ? recovered[1].x - (recovered[0].x + recovered[0].width)
    : recovered[1].y - (recovered[0].y + recovered[0].height);
  const minimumSeparation = split.horizontal ? bounds.width * 0.03 : bounds.height * 0.03;
  if (separation < minimumSeparation) return [];

  return recovered;
}
`;

source = source.slice(0, start) + replacement + source.slice(end);

if (!source.includes("function findSparseBridgeSplit(") || !source.includes("const recoveryGap = 0.12;")) {
  throw new Error("Offset/diagonal sparse-bridge recovery was not fully applied");
}

await fs.writeFile(adapterPath, source);
console.log("Recovered separate architectural openings across off-center and diagonal sparse bridge clutter.");
