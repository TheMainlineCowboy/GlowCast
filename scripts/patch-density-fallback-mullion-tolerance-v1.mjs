import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const crossMullionClearDensity = Math.max(topLeftInterior, topRightInterior, bottomLeftInterior, bottomRightInterior);")) {
  console.log("Density fallback balanced cross-mullion tolerance already present.");
} else {
  const balancedMullionAnchor = `          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);`;

  const crossMullionReplacement = `          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const topLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, top + 2, horizontalMid, verticalMid) / Math.max(1, (horizontalMid - left - 2) * (verticalMid - top - 2))
            : center;
          const topRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1, top + 2, right - 2, verticalMid) / Math.max(1, (right - horizontalMid - 3) * (verticalMid - top - 2))
            : center;
          const bottomLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1, horizontalMid, bottom - 2) / Math.max(1, (horizontalMid - left - 2) * (bottom - verticalMid - 3))
            : center;
          const bottomRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1, verticalMid + 1, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3) * (bottom - verticalMid - 3))
            : center;
          const crossMullionClearDensity = Math.max(topLeftInterior, topRightInterior, bottomLeftInterior, bottomRightInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity, crossMullionClearDensity);`;

  if (!source.includes(balancedMullionAnchor)) {
    throw new Error("Density fallback balanced mullion anchor not found.");
  }

  source = source.replace(balancedMullionAnchor, crossMullionReplacement);
  await fs.writeFile(path, source);
  console.log("Added cross-mullion tolerance that requires all four panes around intersecting dividers to remain hollow.");
}
