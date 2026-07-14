import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const areaGate =
  "satellite.width * satellite.height >= parent.width * parent.height * 0.06";

if ((source.match(new RegExp(areaGate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length >= 2) {
  console.log("negligible satellite rejection ready");
  process.exit(0);
}

const sidePattern = /(satellite\.height\s*>=\s*parent\.height\s*\*\s*0\.62\s*&&\s*\n\s*satellite\.width\s*<=\s*parent\.width\s*\*\s*0\.58)(\s*;)/;
const stackedPattern = /(satellite\.width\s*>=\s*parent\.width\s*\*\s*0\.62\s*&&\s*\n\s*satellite\.height\s*<=\s*parent\.height\s*\*\s*0\.58)(\s*;)/;

if (!sidePattern.test(source)) {
  throw new Error("side satellite area gate anchor not found");
}
source = source.replace(
  sidePattern,
  `$1 &&\n     ${areaGate}$2`,
);

if (!stackedPattern.test(source)) {
  throw new Error("stacked satellite area gate anchor not found");
}
source = source.replace(
  stackedPattern,
  `$1 &&\n     ${areaGate}$2`,
);

await fs.writeFile(path, source);
console.log("negligible satellite rejection ready");
