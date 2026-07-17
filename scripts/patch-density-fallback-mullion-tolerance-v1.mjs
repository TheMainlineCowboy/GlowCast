import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const mullionEvidenceThreshold = Math.max(0.055, frameDensity * 0.22);")) {
  console.log("Density fallback evidence-gated mullion tolerance already present.");
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
          const verticalDividerWidth = Math.max(1, horizontalMullionGutter * 2 + 1);
          const horizontalDividerHeight = Math.max(1, verticalMullionGutter * 2 + 1);
          const verticalMullionEvidence = sumRect(horizontalMid - horizontalMullionGutter, top + 2, horizontalMid + 1 + horizontalMullionGutter, bottom - 2) / Math.max(1, verticalDividerWidth * innerHeight);
          const horizontalMullionEvidence = sumRect(left + 2, verticalMid - verticalMullionGutter, right - 2, verticalMid + 1 + verticalMullionGutter) / Math.max(1, horizontalDividerHeight * innerWidth);
          const mullionEvidenceThreshold = Math.max(0.055, frameDensity * 0.22);
          const verticalMullionInteriorDensity = verticalMullionEvidence >= mullionEvidenceThreshold ? verticalMullionClearDensity : center;
          const horizontalMullionInteriorDensity = horizontalMullionEvidence >= mullionEvidenceThreshold ? horizontalMullionClearDensity : center;
          const crossMullionInteriorDensity = verticalMullionEvidence >= mullionEvidenceThreshold && horizontalMullionEvidence >= mullionEvidenceThreshold
            ? crossMullionClearDensity
            : center;
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionInteriorDensity, horizontalMullionInteriorDensity, crossMullionInteriorDensity);`;

  const previousBodyStart = `          const innerWidth = Math.max(1, widthCells - 4);
          const innerHeight = Math.max(1, heightCells - 4);`;
  const previousBodyEnd = `          const crossMullionClearDensity = Math.max(topLeftInterior, topRightInterior, bottomLeftInterior, bottomRightInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity, crossMullionClearDensity);`;

  const startIndex = source.indexOf(previousBodyStart);
  const endIndex = source.indexOf(previousBodyEnd, startIndex);

  if (startIndex >= 0 && endIndex >= 0) {
    source = source.slice(0, startIndex) + crossMullionBody + source.slice(endIndex + previousBodyEnd.length);
  } else {
    const cleanInstallAnchor = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
          const hollowContrast = frameDensity / Math.max(0.01, center);`;
    const cleanInstallReplacement = `          const center = sumRect(left + 2, top + 2, right - 2, bottom - 2) / Math.max(1, (widthCells - 4) * (heightCells - 4));
          const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4;
${crossMullionBody}
          const hollowContrast = frameDensity / Math.max(0.01, mullionTolerantInteriorDensity);`;

    if (!source.includes(cleanInstallAnchor)) {
      throw new Error("Density fallback mullion-evidence clean-install anchor not found.");
    }
    source = source.replace(cleanInstallAnchor, cleanInstallReplacement);
  }

  await fs.writeFile(path, source);
  console.log("Required visible divider evidence before applying mullion-tolerant pane scoring.");
}
