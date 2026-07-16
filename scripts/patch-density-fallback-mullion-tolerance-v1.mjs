import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);")) {
  console.log("Density fallback balanced mullion tolerance already present.");
} else {
  const legacyBalancedAnchor = `          const verticalMullionClearDensity = (leftInterior + rightInterior) / 2;
          const horizontalMullionClearDensity = (topInterior + bottomInterior) / 2;
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);`;

  if (source.includes(legacyBalancedAnchor)) {
    source = source.replace(
      legacyBalancedAnchor,
      `          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);`
    );
  } else {
    const before = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
          const hollowContrast = frameDensity / Math.max(0.01, center);`;

    const after = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
          const innerWidth = Math.max(1, widthCells - 4);
          const innerHeight = Math.max(1, heightCells - 4);
          const leftInterior = widthCells >= 7
            ? sumRect(left + 2, top + 2, horizontalMid, bottom - 2) / Math.max(1, (horizontalMid - left - 2) * innerHeight)
            : center;
          const rightInterior = widthCells >= 7
            ? sumRect(horizontalMid + 1, top + 2, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3) * innerHeight)
            : center;
          const topInterior = heightCells >= 8
            ? sumRect(left + 2, top + 2, right - 2, verticalMid) / Math.max(1, innerWidth * (verticalMid - top - 2))
            : center;
          const bottomInterior = heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1, right - 2, bottom - 2) / Math.max(1, innerWidth * (bottom - verticalMid - 3))
            : center;
          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);
          const hollowContrast = frameDensity / Math.max(0.01, mullionTolerantInteriorDensity);`;

    if (!source.includes(before)) {
      throw new Error("Density fallback mullion-tolerance anchor not found.");
    }

    source = source.replace(before, after);
  }

  await fs.writeFile(path, source);
  console.log("Added mullion tolerance that requires both panes around a divider to remain hollow.");
}
