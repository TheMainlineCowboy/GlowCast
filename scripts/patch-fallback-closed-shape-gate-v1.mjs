import fs from "node:fs";

const p = "src/core/maskCandidateAdapter.ts";
let s = fs.readFileSync(p, "utf8");
let changed = false;

const typeBefore = `type SideCoverage = {
  sides: number;
  hasHorizontal: boolean;
  hasVertical: boolean;
};`;
const typeAfter = `type SideCoverage = {
  sides: number;
  hasHorizontal: boolean;
  hasVertical: boolean;
  hasOppositeHorizontal: boolean;
  hasOppositeVertical: boolean;
  hasClosedCornerRisk: boolean;
};`;

if (s.includes(typeBefore)) {
  s = s.replace(typeBefore, typeAfter);
  changed = true;
}

const returnBefore = `  return {
    sides: [topPresent, bottomPresent, leftPresent, rightPresent].filter(Boolean).length,
    hasHorizontal: topPresent || bottomPresent,
    hasVertical: leftPresent || rightPresent
  };`;
const returnAfter = `  return {
    sides: [topPresent, bottomPresent, leftPresent, rightPresent].filter(Boolean).length,
    hasHorizontal: topPresent || bottomPresent,
    hasVertical: leftPresent || rightPresent,
    hasOppositeHorizontal: topPresent && bottomPresent,
    hasOppositeVertical: leftPresent && rightPresent,
    hasClosedCornerRisk:
      (topPresent && leftPresent && !bottomPresent && !rightPresent) ||
      (topPresent && rightPresent && !bottomPresent && !leftPresent) ||
      (bottomPresent && leftPresent && !topPresent && !rightPresent) ||
      (bottomPresent && rightPresent && !topPresent && !leftPresent)
  };`;

if (s.includes(returnBefore)) {
  s = s.replace(returnBefore, returnAfter);
  changed = true;
}

const gateBefore = `    if (sideCoverage.sides < 2 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;`;
const gateAfter = `    // Fallback masks should be closed-ish architectural objects, not stray trim corners.
    // Require at least three detected sides, or a full four-side opposite-pair closure.
    if (!sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;
    if (sideCoverage.hasClosedCornerRisk) continue;
    if (sideCoverage.sides < 3 && !(sideCoverage.hasOppositeHorizontal && sideCoverage.hasOppositeVertical)) continue;`;

if (s.includes(gateBefore)) {
  s = s.replace(gateBefore, gateAfter);
  changed = true;
}

if (!changed) {
  console.log("No changes made. Fallback closed-shape gate may already be applied.");
} else {
  fs.writeFileSync(p, s);
  console.log("Applied fallback closed-shape gate patch.");
}
