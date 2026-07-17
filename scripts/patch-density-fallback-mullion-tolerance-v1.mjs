import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const offCenterHorizontalMullionInteriorDensity = heightCells >= 10")) {
  console.log("Density fallback off-center horizontal mullion recovery already present.");
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
          const verticalTopHeight = Math.max(1, verticalMid - top - 2);
          const verticalBottomHeight = Math.max(1, bottom - verticalMid - 3);
          const horizontalLeftWidth = Math.max(1, horizontalMid - left - 2);
          const horizontalRightWidth = Math.max(1, right - horizontalMid - 3);
          const verticalMullionTopEvidence = sumRect(horizontalMid - horizontalMullionGutter, top + 2, horizontalMid + 1 + horizontalMullionGutter, verticalMid) / Math.max(1, verticalDividerWidth * verticalTopHeight);
          const verticalMullionBottomEvidence = sumRect(horizontalMid - horizontalMullionGutter, verticalMid + 1, horizontalMid + 1 + horizontalMullionGutter, bottom - 2) / Math.max(1, verticalDividerWidth * verticalBottomHeight);
          const horizontalMullionLeftEvidence = sumRect(left + 2, verticalMid - verticalMullionGutter, horizontalMid, verticalMid + 1 + verticalMullionGutter) / Math.max(1, horizontalDividerHeight * horizontalLeftWidth);
          const horizontalMullionRightEvidence = sumRect(horizontalMid + 1, verticalMid - verticalMullionGutter, right - 2, verticalMid + 1 + verticalMullionGutter) / Math.max(1, horizontalDividerHeight * horizontalRightWidth);
          const verticalMullionEvidence = Math.min(verticalMullionTopEvidence, verticalMullionBottomEvidence);
          const horizontalMullionEvidence = Math.min(horizontalMullionLeftEvidence, horizontalMullionRightEvidence);
          const mullionIntersectionEvidence = sumRect(horizontalMid - horizontalMullionGutter, verticalMid - verticalMullionGutter, horizontalMid + 1 + horizontalMullionGutter, verticalMid + 1 + verticalMullionGutter) / Math.max(1, verticalDividerWidth * horizontalDividerHeight);
          const crossMullionEvidence = Math.min(verticalMullionEvidence, horizontalMullionEvidence, mullionIntersectionEvidence);
          const mullionEvidenceThreshold = Math.max(0.055, frameDensity * 0.22);
          const crossMullionEvidenceThreshold = Math.max(mullionEvidenceThreshold * 1.18, frameDensity * 0.28);
          const offCenterVerticalMullionInteriorDensity = widthCells >= 9
            ? [-1, 1].reduce((bestDensity, offset) => {
                const dividerMid = horizontalMid + offset;
                const leftPaneWidth = dividerMid - left - 2 - horizontalMullionGutter;
                const rightPaneWidth = right - dividerMid - 3 - horizontalMullionGutter;
                if (leftPaneWidth < 2 || rightPaneWidth < 2) return bestDensity;
                const shiftedLeftInterior = sumRect(left + 2, top + 2, dividerMid - horizontalMullionGutter, bottom - 2) / Math.max(1, leftPaneWidth * innerHeight);
                const shiftedRightInterior = sumRect(dividerMid + 1 + horizontalMullionGutter, top + 2, right - 2, bottom - 2) / Math.max(1, rightPaneWidth * innerHeight);
                const shiftedTopEvidence = sumRect(dividerMid - horizontalMullionGutter, top + 2, dividerMid + 1 + horizontalMullionGutter, verticalMid) / Math.max(1, verticalDividerWidth * verticalTopHeight);
                const shiftedBottomEvidence = sumRect(dividerMid - horizontalMullionGutter, verticalMid + 1, dividerMid + 1 + horizontalMullionGutter, bottom - 2) / Math.max(1, verticalDividerWidth * verticalBottomHeight);
                const shiftedEvidence = Math.min(shiftedTopEvidence, shiftedBottomEvidence);
                const shiftedClearDensity = Math.max(shiftedLeftInterior, shiftedRightInterior);
                return shiftedEvidence >= mullionEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;
              }, center)
            : center;
          const offCenterHorizontalMullionInteriorDensity = heightCells >= 10
            ? [-1, 1].reduce((bestDensity, offset) => {
                const dividerMid = verticalMid + offset;
                const topPaneHeight = dividerMid - top - 2 - verticalMullionGutter;
                const bottomPaneHeight = bottom - dividerMid - 3 - verticalMullionGutter;
                if (topPaneHeight < 2 || bottomPaneHeight < 2) return bestDensity;
                const shiftedTopInterior = sumRect(left + 2, top + 2, right - 2, dividerMid - verticalMullionGutter) / Math.max(1, innerWidth * topPaneHeight);
                const shiftedBottomInterior = sumRect(left + 2, dividerMid + 1 + verticalMullionGutter, right - 2, bottom - 2) / Math.max(1, innerWidth * bottomPaneHeight);
                const shiftedLeftEvidence = sumRect(left + 2, dividerMid - verticalMullionGutter, horizontalMid, dividerMid + 1 + verticalMullionGutter) / Math.max(1, horizontalDividerHeight * horizontalLeftWidth);
                const shiftedRightEvidence = sumRect(horizontalMid + 1, dividerMid - verticalMullionGutter, right - 2, dividerMid + 1 + verticalMullionGutter) / Math.max(1, horizontalDividerHeight * horizontalRightWidth);
                const shiftedEvidence = Math.min(shiftedLeftEvidence, shiftedRightEvidence);
                const shiftedClearDensity = Math.max(shiftedTopInterior, shiftedBottomInterior);
                return shiftedEvidence >= mullionEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;
              }, center)
            : center;
          const verticalMullionInteriorDensity = Math.min(
            verticalMullionEvidence >= mullionEvidenceThreshold ? verticalMullionClearDensity : center,
            offCenterVerticalMullionInteriorDensity
          );
          const horizontalMullionInteriorDensity = Math.min(
            horizontalMullionEvidence >= mullionEvidenceThreshold ? horizontalMullionClearDensity : center,
            offCenterHorizontalMullionInteriorDensity
          );
          const crossMullionInteriorDensity = crossMullionEvidence >= crossMullionEvidenceThreshold
            ? crossMullionClearDensity
            : center;
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionInteriorDensity, horizontalMullionInteriorDensity, crossMullionInteriorDensity);`;

  const previousBodyStart = `          const innerWidth = Math.max(1, widthCells - 4);
          const innerHeight = Math.max(1, heightCells - 4);`;
  const previousBodyEnd = `          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionInteriorDensity, horizontalMullionInteriorDensity, crossMullionInteriorDensity);`;

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
      throw new Error("Density fallback off-center horizontal mullion clean-install anchor not found.");
    }
    source = source.replace(cleanInstallAnchor, cleanInstallReplacement);
  }

  await fs.writeFile(path, source);
  console.log("Recovered one-cell off-center horizontal mullions while retaining two-half evidence and pane-clearance safeguards.");
}
