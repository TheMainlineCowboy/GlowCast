import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const horizontalMullionGutter = widthCells >= 13 ? 2 : widthCells >= 9 ? 1 : 0;")) {
  console.log("Density fallback extra-thick mullion tolerance already present.");
} else {
  const crossMullionBody = `          const innerWidth = Math.max(1, widthCells - 4);
          const innerHeight = Math.max(1, heightCells - 4);
          const horizontalMullionGutter = widthCells >= 13 ? 2 : widthCells >= 9 ? 1 : 0;
          const verticalMullionGutter = heightCells >= 14 ? 2 : heightCells >= 10 ? 1 : 0;
          const leftInterior = widthCells >= 7
            ? sumRect(left + 2, top + 2, horizontalMid - horizontalMullionGutter, bottom - 2) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * innerHeight)
            : center;
          const rightInterior = widthCells >= 7
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, top + 2, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * innerHeight)
            : center;
          const topInterior = heightCells >= 8
            ? sumRect(left + 2, top + 2, right - 2, verticalMid - verticalMullionGutter) / Math.max(1, innerWidth * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const bottomInterior = heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1 + verticalMullionGutter, right - 2, bottom - 2) / Math.max(1, innerWidth * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const topLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, top + 2, horizontalMid - horizontalMullionGutter, verticalMid - verticalMullionGutter) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const topRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, top + 2, right - 2, verticalMid - verticalMullionGutter) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const bottomLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1 + verticalMullionGutter, horizontalMid - horizontalMullionGutter, bottom - 2) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const bottomRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, verticalMid + 1 + verticalMullionGutter, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const crossMullionClearDensity = Math.max(topLeftInterior, topRightInterior, bottomLeftInterior, bottomRightInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity, crossMullionClearDensity);`;

  const previousThickMullionBody = `          const innerWidth = Math.max(1, widthCells - 4);
          const innerHeight = Math.max(1, heightCells - 4);
          const horizontalMullionGutter = widthCells >= 9 ? 1 : 0;
          const verticalMullionGutter = heightCells >= 10 ? 1 : 0;
          const leftInterior = widthCells >= 7
            ? sumRect(left + 2, top + 2, horizontalMid - horizontalMullionGutter, bottom - 2) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * innerHeight)
            : center;
          const rightInterior = widthCells >= 7
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, top + 2, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * innerHeight)
            : center;
          const topInterior = heightCells >= 8
            ? sumRect(left + 2, top + 2, right - 2, verticalMid - verticalMullionGutter) / Math.max(1, innerWidth * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const bottomInterior = heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1 + verticalMullionGutter, right - 2, bottom - 2) / Math.max(1, innerWidth * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const topLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, top + 2, horizontalMid - horizontalMullionGutter, verticalMid - verticalMullionGutter) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const topRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, top + 2, right - 2, verticalMid - verticalMullionGutter) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * (verticalMid - top - 2 - verticalMullionGutter))
            : center;
          const bottomLeftInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(left + 2, verticalMid + 1 + verticalMullionGutter, horizontalMid - horizontalMullionGutter, bottom - 2) / Math.max(1, (horizontalMid - left - 2 - horizontalMullionGutter) * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const bottomRightInterior = widthCells >= 7 && heightCells >= 8
            ? sumRect(horizontalMid + 1 + horizontalMullionGutter, verticalMid + 1 + verticalMullionGutter, right - 2, bottom - 2) / Math.max(1, (right - horizontalMid - 3 - horizontalMullionGutter) * (bottom - verticalMid - 3 - verticalMullionGutter))
            : center;
          const crossMullionClearDensity = Math.max(topLeftInterior, topRightInterior, bottomLeftInterior, bottomRightInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity, crossMullionClearDensity);`;

  if (source.includes(previousThickMullionBody)) {
    source = source.replace(previousThickMullionBody, crossMullionBody);
  } else {
    const cleanInstallAnchor = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
          const hollowContrast = frameDensity / Math.max(0.01, center);`;
    const cleanInstallReplacement = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
${crossMullionBody}
          const hollowContrast = frameDensity / Math.max(0.01, mullionTolerantInteriorDensity);`;

    if (!source.includes(cleanInstallAnchor)) {
      throw new Error("Density fallback extra-thick mullion clean-install anchor not found.");
    }
    source = source.replace(cleanInstallAnchor, cleanInstallReplacement);
  }

  await fs.writeFile(path, source);
  console.log("Scaled pane gutters for extra-thick center bars while preserving minimum pane area.");
}
