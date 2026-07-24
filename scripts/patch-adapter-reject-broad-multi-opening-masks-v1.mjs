import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");
let changed = false;

const marker = "function rejectBroadMultiOpeningMasks(";
if (!source.includes(marker)) {
  const insertAt = source.indexOf("export function buildMaskCandidatesFromEdges(");
  if (insertAt < 0) throw new Error("Unable to locate mask candidate builder for broad-mask suppression");

  const helper = `function rejectBroadMultiOpeningMasks(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const area = (candidate: MaskCandidateOutput) => Math.max(candidate.box.width * candidate.box.height, 1);
  const center = (candidate: MaskCandidateOutput) => ({
    x: candidate.box.x + candidate.box.width / 2,
    y: candidate.box.y + candidate.box.height / 2
  });
  const containsCenter = (outer: MaskCandidateOutput, inner: MaskCandidateOutput) => {
    const point = center(inner);
    const marginX = Math.max(0.5, outer.box.width * 0.025);
    const marginY = Math.max(0.5, outer.box.height * 0.025);
    return (
      point.x >= outer.box.x + marginX &&
      point.x <= outer.box.x + outer.box.width - marginX &&
      point.y >= outer.box.y + marginY &&
      point.y <= outer.box.y + outer.box.height - marginY
    );
  };

  return candidates.filter((candidate) => {
    const candidateArea = area(candidate);
    // Only challenge masks large enough to plausibly swallow multiple separate openings.
    if (candidateArea < boundsArea * 0.075) return true;

    const contained = candidates
      .filter((other) => other !== candidate)
      .filter((other) => {
        const otherArea = area(other);
        return (
          otherArea <= candidateArea * 0.46 &&
          otherArea >= candidateArea * 0.035 &&
          containsCenter(candidate, other)
        );
      })
      .sort((a, b) => area(b) - area(a));

    if (contained.length < 2) return true;

    for (let i = 0; i < contained.length; i += 1) {
      for (let j = i + 1; j < contained.length; j += 1) {
        const first = contained[i];
        const second = contained[j];
        const firstCenter = center(first);
        const secondCenter = center(second);
        const separationX = Math.abs(firstCenter.x - secondCenter.x) / Math.max(candidate.box.width, 1);
        const separationY = Math.abs(firstCenter.y - secondCenter.y) / Math.max(candidate.box.height, 1);
        const pairSeparated = separationX >= 0.24 || separationY >= 0.24;
        const pairOverlap = overlapRatio(first.box, second.box);
        const pairArea = area(first) + area(second);
        const meaningfulPair = pairArea >= candidateArea * 0.16;

        // A broad candidate is rejected only when it encloses two meaningful,
        // clearly distinct sub-candidates. This avoids deleting legitimate outer
        // frames that contain one nested pane/detail while suppressing facade-scale
        // boxes that swallow multiple separate windows or doors.
        if (pairSeparated && pairOverlap < 0.42 && meaningfulPair) return false;
      }
    }

    return true;
  });
}

`;

  source = source.slice(0, insertAt) + helper + source.slice(insertAt);
  changed = true;
}

const buildStart = source.indexOf("export function buildMaskCandidatesFromEdges(");
if (buildStart < 0) throw new Error("Unable to locate mask candidate builder");
const buildSource = source.slice(buildStart);
const returnMatches = [...buildSource.matchAll(/^  return (.+);$/gm)];
const finalReturn = returnMatches.at(-1);
if (!finalReturn || finalReturn.index === undefined) throw new Error("Unable to locate final mask candidate return pipeline");

const returnExpression = finalReturn[1];
if (!returnExpression.includes("rejectBroadMultiOpeningMasks(")) {
  const absoluteReturnStart = buildStart + finalReturn.index;
  const originalReturn = finalReturn[0];
  const wrappedReturn = `  return rejectBroadMultiOpeningMasks(${returnExpression}, bounds);`;
  source = source.slice(0, absoluteReturnStart) + wrappedReturn + source.slice(absoluteReturnStart + originalReturn.length);
  changed = true;
}

if (!source.includes(marker) || !source.includes("return rejectBroadMultiOpeningMasks(")) {
  throw new Error("Broad multi-opening mask suppression helper and return wrapper were not both established");
}

if (changed) {
  await fs.writeFile(adapterPath, source);
  console.log("Suppressed broad automatic masks only when they enclose multiple distinct architectural candidates.");
} else {
  console.log("Broad multi-opening automatic-mask suppression already complete.");
}
