import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function cleanMaskOutline(";
if (source.includes(marker)) {
  console.log("clean mask outline patch already applied");
  process.exit(0);
}

const groupStart = source.indexOf("function groupNearbySatellites(");
if (groupStart < 0) throw new Error("Unable to locate satellite grouping function");

const helper = `function cleanMaskOutline(points: SimplePoint[], box: SimpleBox, bounds: SimpleBox): SimplePoint[] {
  if (points.length < 4) return points;

  const scale = Math.max(0.12, Math.min(bounds.width, bounds.height) * 0.0045);
  const deduped: SimplePoint[] = [];

  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= scale) {
      deduped.push(point);
    }
  }

  if (deduped.length > 2) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < scale) deduped.pop();
  }

  const simplified = [...deduped];
  let changed = true;
  while (changed && simplified.length > 4) {
    changed = false;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      if (distanceToSegment(current, previous, next) <= scale * 0.7) {
        simplified.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  const cleaned = simplified.length >= 3 ? simplified : boxPoints(box);
  return cleaned.map((point) => ({
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  }));
}

function cleanMaskCandidateOutlines(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  return candidates.map((candidate) => ({
    ...candidate,
    points: cleanMaskOutline(candidate.points, candidate.box, bounds)
  }));
}

`;

source = source.slice(0, groupStart) + helper + source.slice(groupStart);

const buildStart = source.indexOf("export function buildMaskCandidatesFromEdges(");
if (buildStart < 0) throw new Error("Unable to locate mask candidate builder");

const buildSource = source.slice(buildStart);
const returnMatches = [...buildSource.matchAll(/^  return (.+);$/gm)];
const finalReturn = returnMatches.at(-1);
if (!finalReturn || finalReturn.index === undefined) {
  throw new Error("Unable to locate final mask candidate return pipeline");
}

const returnExpression = finalReturn[1];
if (returnExpression.includes("cleanMaskCandidateOutlines(")) {
  throw new Error("Mask cleanup return pipeline was partially applied without its helper marker");
}

const absoluteReturnStart = buildStart + finalReturn.index;
const originalReturn = finalReturn[0];
const cleanedReturn = `  return cleanMaskCandidateOutlines(${returnExpression}, bounds);`;
source = source.slice(0, absoluteReturnStart) + cleanedReturn + source.slice(absoluteReturnStart + originalReturn.length);

await fs.writeFile(adapterPath, source);
console.log("applied clean mask outline patch");
