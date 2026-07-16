import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("function buildDensityWindowFallbacks(")) {
  console.log("Density-window fallback already present.");
} else {
  const marker = "function addFallbackCandidates(";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error("Fallback candidate insertion anchor not found.");

  const helper = `function buildDensityWindowFallbacks(edgePoints: EdgePoint[], bounds: SimpleBox): FallbackComponent[] {
  const columns = 48;
  const rows = 36;
  const grid = new Float64Array(columns * rows);

  for (const point of edgePoints) {
    if (point.strength < 72) continue;
    if (point.x < bounds.x || point.x > bounds.x + bounds.width) continue;
    if (point.y < bounds.y || point.y > bounds.y + bounds.height) continue;
    const column = Math.min(columns - 1, Math.max(0, Math.floor(((point.x - bounds.x) / Math.max(bounds.width, 0.01)) * columns)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((point.y - bounds.y) / Math.max(bounds.height, 0.01)) * rows)));
    grid[row * columns + column] += 0.35 + point.strength / 255;
  }

  const integral = new Float64Array((columns + 1) * (rows + 1));
  for (let row = 0; row < rows; row += 1) {
    let running = 0;
    for (let column = 0; column < columns; column += 1) {
      running += grid[row * columns + column];
      const index = (row + 1) * (columns + 1) + column + 1;
      integral[index] = integral[row * (columns + 1) + column + 1] + running;
    }
  }

  const sumRect = (left: number, top: number, right: number, bottom: number) => {
    const x1 = Math.max(0, Math.min(columns, left));
    const y1 = Math.max(0, Math.min(rows, top));
    const x2 = Math.max(x1, Math.min(columns, right));
    const y2 = Math.max(y1, Math.min(rows, bottom));
    return integral[y2 * (columns + 1) + x2] - integral[y1 * (columns + 1) + x2] - integral[y2 * (columns + 1) + x1] + integral[y1 * (columns + 1) + x1];
  };

  const proposals: FallbackComponent[] = [];
  const widths = [7, 9, 11, 13];
  const heights = [6, 8, 10, 12];

  for (const widthCells of widths) {
    for (const heightCells of heights) {
      for (let top = 1; top + heightCells < rows - 1; top += 2) {
        for (let left = 1; left + widthCells < columns - 1; left += 2) {
          const right = left + widthCells;
          const bottom = top + heightCells;
          const inside = sumRect(left, top, right, bottom);
          const insideArea = widthCells * heightCells;
          const outer = sumRect(left - 2, top - 2, right + 2, bottom + 2);
          const outerArea = (widthCells + 4) * (heightCells + 4);
          const ringDensity = (outer - inside) / Math.max(1, outerArea - insideArea);
          const insideDensity = inside / Math.max(1, insideArea);

          const topBand = sumRect(left, top, right, top + 1) / Math.max(1, widthCells);
          const bottomBand = sumRect(left, bottom - 1, right, bottom) / Math.max(1, widthCells);
          const leftBand = sumRect(left, top, left + 1, bottom) / Math.max(1, heightCells);
          const rightBand = sumRect(right - 1, top, right, bottom) / Math.max(1, heightCells);
          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
          const hollowContrast = frameDensity / Math.max(0.01, center);
          const sideThreshold = Math.max(0.08, ringDensity * 1.08, center * 0.72);
          const sideDensities = [topBand, bottomBand, leftBand, rightBand];
          const supportedSides = sideDensities.filter((density) => density >= sideThreshold).length;
          const weakestSide = Math.min(...sideDensities);
          const strongestSide = Math.max(...sideDensities);
          const sideBalance = weakestSide / Math.max(0.01, strongestSide);
          const horizontalBalance = Math.min(topBand, bottomBand) / Math.max(0.01, Math.max(topBand, bottomBand));
          const verticalBalance = Math.min(leftBand, rightBand) / Math.max(0.01, Math.max(leftBand, rightBand));
          const oppositeSideBalance = Math.min(horizontalBalance, verticalBalance);
          const contrast = insideDensity / Math.max(0.01, ringDensity);

          // Density windows are a last-resort recovery path. Require a closed four-sided
          // frame with a quieter center and balanced opposite edges so a single shadow,
          // trim line, or partial border cannot complete an otherwise weak rectangle.
          if (insideDensity <= 0 || contrast < 1.08 || hollowContrast < 1.12 || supportedSides < 4 || weakestSide < sideThreshold || sideBalance < 0.34 || oppositeSideBalance < 0.42) continue;

          const box = {
            x: bounds.x + (left / columns) * bounds.width,
            y: bounds.y + (top / rows) * bounds.height,
            width: (widthCells / columns) * bounds.width,
            height: (heightCells / rows) * bounds.height
          };
          const aspect = box.width / Math.max(box.height, 0.01);
          if (aspect < 0.35 || aspect > 2.8) continue;

          proposals.push({
            ...box,
            cells: insideArea,
            edgeCount: Math.round(inside),
            points: boxPoints(box),
            score: contrast * 1.6 + hollowContrast * 1.4 + supportedSides * 0.45 + sideBalance * 0.6 + oppositeSideBalance * 0.65 + frameDensity * 0.04
          });
        }
      }
    }
  }

  const accepted: FallbackComponent[] = [];
  for (const proposal of proposals.sort((a, b) => b.score - a.score)) {
    if (accepted.some((existing) => overlapRatio(existing, proposal) > 0.48)) continue;
    accepted.push(proposal);
    if (accepted.length >= 6) break;
  }
  return accepted;
}

`;

  source = source.slice(0, markerIndex) + helper + source.slice(markerIndex);
  const loop = "  for (const fallback of buildFallbackComponents(edgePoints, bounds)) {";
  const replacement = "  const componentFallbacks = buildFallbackComponents(edgePoints, bounds);\n  const fallbackPool = componentFallbacks.length ? componentFallbacks : buildDensityWindowFallbacks(edgePoints, bounds);\n\n  for (const fallback of fallbackPool) {";
  if (!source.includes(loop)) throw new Error("Fallback loop anchor not found.");
  source = source.replace(loop, replacement);
  await fs.writeFile(path, source);
  console.log("Added density-window fallback for textured real-wall images.");
}
