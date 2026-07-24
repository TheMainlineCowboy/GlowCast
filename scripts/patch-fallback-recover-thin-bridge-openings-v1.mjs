import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function recoverSparseBridgeComponents(";
if (!source.includes(marker)) {
  const insertAt = source.indexOf("function buildFallbackComponents(");
  if (insertAt < 0) throw new Error("Unable to locate fallback component builder");

  const helper = `function recoverSparseBridgeComponents(points: EdgePoint[], box: SimpleBox, bounds: SimpleBox): FallbackComponent[] {
  if (!hasSparseMidBridge(points, box, bounds)) return [];

  const horizontal = box.width >= box.height;
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const groups = [
    points.filter((point) => {
      const position = horizontal
        ? (point.x - box.x) / Math.max(box.width, 0.01)
        : (point.y - box.y) / Math.max(box.height, 0.01);
      return position <= 0.46;
    }),
    points.filter((point) => {
      const position = horizontal
        ? (point.x - box.x) / Math.max(box.width, 0.01)
        : (point.y - box.y) / Math.max(box.height, 0.01);
      return position >= 0.54;
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

  const separation = horizontal
    ? recovered[1].x - (recovered[0].x + recovered[0].width)
    : recovered[1].y - (recovered[0].y + recovered[0].height);
  const minimumSeparation = horizontal ? bounds.width * 0.03 : bounds.height * 0.03;
  if (separation < minimumSeparation) return [];

  return recovered;
}

`;

  source = source.slice(0, insertAt) + helper + source.slice(insertAt);
}

const rejectionGate = "    if (hasSparseMidBridge(componentPoints, box, bounds)) continue;";
const recoveryGate = `    const recoveredBridgeComponents = recoverSparseBridgeComponents(componentPoints, box, bounds);
    if (recoveredBridgeComponents.length === 2) {
      components.push(...recoveredBridgeComponents);
      continue;
    }
    if (hasSparseMidBridge(componentPoints, box, bounds)) continue;`;

if (!source.includes(recoveryGate)) {
  if (!source.includes(rejectionGate)) throw new Error("Unable to locate thin-bridge rejection gate");
  source = source.replace(rejectionGate, recoveryGate);
}

if (!source.includes(marker) || !source.includes("components.push(...recoveredBridgeComponents)")) {
  throw new Error("Thin-bridge opening recovery was not fully applied");
}

await fs.writeFile(adapterPath, source);
console.log("Recovered two closed architectural regions from qualifying thin-bridge fallback components before rejecting the broad bridge.");
