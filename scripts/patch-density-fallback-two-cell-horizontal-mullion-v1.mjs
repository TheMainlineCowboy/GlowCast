import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const offsetsFragment = "const horizontalOffsets = heightCells >= 14 ? [-2, -1, 1, 2] : [-1, 1];";
const oldThreshold = "Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)";
const strongerThreshold = "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)";

if (!source.includes(offsetsFragment)) {
  const oldStart = `          const offCenterHorizontalMullionInteriorDensity = heightCells >= 10
            ? [-1, 1].reduce((bestDensity, offset) => {`;
  const newStart = `          const horizontalOffsets = heightCells >= 14 ? [-2, -1, 1, 2] : [-1, 1];
          const offCenterHorizontalMullionInteriorDensity = heightCells >= 10
            ? horizontalOffsets.reduce((bestDensity, offset) => {`;
  const oldGate = `                return shiftedEvidence >= mullionEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;
  const newGate = `                const shiftedEvidenceThreshold = Math.abs(offset) === 2
                  ? ${strongerThreshold}
                  : mullionEvidenceThreshold;
                return shiftedEvidence >= shiftedEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;

  if (!source.includes(oldStart) || !source.includes(oldGate)) {
    throw new Error("Two-cell horizontal mullion recovery anchors not found.");
  }
  source = source.replace(oldStart, newStart).replace(oldGate, newGate);
} else if (source.includes(oldThreshold)) {
  source = source.replace(oldThreshold, strongerThreshold);
}

if (!source.includes(offsetsFragment) || !source.includes(strongerThreshold)) {
  throw new Error("Stricter two-cell horizontal mullion confidence was not applied.");
}

const closureAnchor = "    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;";
const closureGate = `    if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;
    // Very wide or very tall fallback components are especially likely to be trim,
    // seams, gutters, or railings. Require a fully closed outline before exposing
    // them as automatic masks, while preserving three-sided recovery for ordinary
    // doors, arches, and windows.
    const extremeAspect = aspect < 0.35 || aspect > 3.2;
    if (extremeAspect && sideCoverage.sides < 4) continue;`;

if (!source.includes("const extremeAspect = aspect < 0.35 || aspect > 3.2;")) {
  if (!source.includes(closureAnchor)) {
    throw new Error("Fallback side-coverage anchor not found.");
  }
  source = source.replace(closureAnchor, closureGate);
}

if (!source.includes("if (extremeAspect && sideCoverage.sides < 4) continue;")) {
  throw new Error("Extreme-aspect fallback closure gate was not applied.");
}

const duplicateAnchor = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      if (fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;
const extremeDuplicateGate = `      const existing = next[duplicateIndex];
      const existingArea = existing.box.width * existing.box.height;
      const fallbackArea = box.width * box.height;
      const fallbackAspect = box.width / Math.max(box.height, 0.01);
      const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;
      // Long, thin fallbacks may be valid closed fixtures, but they should never
      // displace a stronger architectural detector result in the same region.
      if (!extremeFallbackAspect && fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;

if (!source.includes("const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;")) {
  if (!source.includes(duplicateAnchor)) {
    throw new Error("Fallback duplicate replacement anchor not found.");
  }
  source = source.replace(duplicateAnchor, extremeDuplicateGate);
}

const shapeAnchor = `      const fallbackAspect = box.width / Math.max(box.height, 0.01);
      const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;
      // Long, thin fallbacks may be valid closed fixtures, but they should never
      // displace a stronger architectural detector result in the same region.
      if (!extremeFallbackAspect && fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {`;
const shapeGate = `      const fallbackAspect = box.width / Math.max(box.height, 0.01);
      const existingAspect = existing.box.width / Math.max(existing.box.height, 0.01);
      const aspectChange = Math.max(fallbackAspect / existingAspect, existingAspect / fallbackAspect);
      const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;
      const shapeConsistentFallback = aspectChange <= 1.6;
      // A larger fallback may repair a fragmented opening, but it should not turn a
      // strong window or door into a differently shaped mask by absorbing nearby trim.
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        fallbackArea > existingArea * 1.12 &&
        fallback.score >= 1.2
      ) {`;

if (!source.includes("const shapeConsistentFallback = aspectChange <= 1.6;")) {
  if (!source.includes(shapeAnchor)) {
    throw new Error("Fallback duplicate shape-consistency anchor not found.");
  }
  source = source.replace(shapeAnchor, shapeGate);
}

if (!source.includes("shapeConsistentFallback &&") || !source.includes("const aspectChange = Math.max(fallbackAspect / existingAspect, existingAspect / fallbackAspect);")) {
  throw new Error("Fallback duplicate shape consistency was not applied.");
}

await fs.writeFile(path, source);
console.log("Recovered two-cell horizontal mullions, required extreme-aspect closure, and preserved stronger masks from shape-distorting fallback duplicates.");
