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

const replacement = `function recoverSparseBridgeComponents(points: EdgePoint[], box: SimpleBox, bounds: SimpleBox): FallbackComponent[] {
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  // Keep enough of each side of a locally detected sparse run for narrow openings to
  // retain their real border. Bridge tails are trimmed structurally by describeGroup,
  // so recovery no longer needs the old coarse 12%-per-side exclusion zone.
  const recoveryGap = 0.055;

  const describeGroup = (group: EdgePoint[], trimHorizontal: boolean): { points: EdgePoint[]; box: SimpleBox } | null => {
    if (group.length < 24) return null;
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

    // A one-pixel bridge tail can stretch the raw bounding box beyond the real frame.
    // Trim the split-axis ends to coordinates with substantial cross-axis support so
    // the actual architectural border remains on the recovered box boundary.
    if (trimHorizontal) {
      const support = new Map<number, Set<number>>();
      for (const point of group) {
        const key = Math.round(point.x);
        const values = support.get(key) ?? new Set<number>();
        values.add(Math.round(point.y));
        support.set(key, values);
      }
      const threshold = Math.max(4, Math.ceil((maxY - minY) * 0.18));
      const structural = [...support.entries()].filter(([, values]) => values.size >= threshold).map(([coordinate]) => coordinate);
      if (structural.length >= 2) {
        minX = Math.max(minX, Math.min(...structural));
        maxX = Math.min(maxX, Math.max(...structural));
      }
    } else {
      const support = new Map<number, Set<number>>();
      for (const point of group) {
        const key = Math.round(point.y);
        const values = support.get(key) ?? new Set<number>();
        values.add(Math.round(point.x));
        support.set(key, values);
      }
      const threshold = Math.max(4, Math.ceil((maxX - minX) * 0.18));
      const structural = [...support.entries()].filter(([, values]) => values.size >= threshold).map(([coordinate]) => coordinate);
      if (structural.length >= 2) {
        minY = Math.max(minY, Math.min(...structural));
        maxY = Math.min(maxY, Math.max(...structural));
      }
    }

    const trimmedPoints = group.filter((point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY);
    return {
      points: trimmedPoints,
      box: clampBox(
        { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) },
        bounds
      )
    };
  };

  const splitGroup = (group: EdgePoint[], groupBox: SimpleBox) => {
    const split = findSparseBridgeSplit(group, groupBox, bounds);
    if (!split) return null;

    const groups = [
      group.filter((point) => {
        const position = split.horizontal
          ? (point.x - groupBox.x) / Math.max(groupBox.width, 0.01)
          : (point.y - groupBox.y) / Math.max(groupBox.height, 0.01);
        return position <= split.position - recoveryGap;
      }),
      group.filter((point) => {
        const position = split.horizontal
          ? (point.x - groupBox.x) / Math.max(groupBox.width, 0.01)
          : (point.y - groupBox.y) / Math.max(groupBox.height, 0.01);
        return position >= split.position + recoveryGap;
      })
    ];

    const described = groups.map((candidate) => describeGroup(candidate, split.horizontal));
    if (!described[0] || !described[1]) return null;
    const first = described[0];
    const second = described[1];
    const separation = split.horizontal
      ? second.box.x - (first.box.x + first.box.width)
      : second.box.y - (first.box.y + first.box.height);
    const minimumSeparation = split.horizontal ? bounds.width * 0.03 : bounds.height * 0.03;
    if (separation < minimumSeparation) return null;
    return [first, second] as const;
  };

  const initialSplit = splitGroup(points, box);
  if (!initialSplit) return [];

  const queue = [...initialSplit].map((group) => ({ ...group, depth: 0 }));
  const terminal: Array<{ points: EdgePoint[]; box: SimpleBox }> = [];

  while (queue.length) {
    const current = queue.shift()!;
    const nested = current.depth < 2 ? splitGroup(current.points, current.box) : null;
    if (nested && terminal.length + queue.length + nested.length <= 5) {
      queue.push(...nested.map((group) => ({ ...group, depth: current.depth + 1 })));
    } else {
      terminal.push({ points: current.points, box: current.box });
    }
  }

  if (terminal.length < 2) return [];
  const recovered: FallbackComponent[] = [];
  for (const terminalGroup of terminal) {
    const recoveredBox = terminalGroup.box;
    const area = recoveredBox.width * recoveredBox.height;
    if (
      recoveredBox.width < Math.max(5, bounds.width * 0.055) ||
      recoveredBox.height < Math.max(5, bounds.height * 0.055) ||
      area < boundsArea * 0.008
    ) return [];

    const sideCoverage = getFallbackSideCoverage(terminalGroup.points, recoveredBox);
    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) return [];

    const densityScore = terminalGroup.points.length / Math.max(area, 1);
    recovered.push({
      ...recoveredBox,
      cells: terminalGroup.points.length,
      edgeCount: terminalGroup.points.length,
      points: buildOutlineFromPoints(terminalGroup.points, recoveredBox),
      score: densityScore + sideCoverage.sides * 0.22 + 0.75
    });
  }

  return recovered.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);

if (!source.includes("const recoveryGap = 0.055;") || !source.includes("const initialSplit = splitGroup(points, box);") || !source.includes("current.depth < 2") || !source.includes("substantial cross-axis support") || !source.includes("terminal.length + queue.length + nested.length <= 5")) {
  throw new Error("Multi-opening sparse-bridge recovery was not fully applied");
}

await fs.writeFile(adapterPath, source);
console.log("Recovered multiple architectural openings from clutter-connected fallback components while trimming sparse bridge tails.");
