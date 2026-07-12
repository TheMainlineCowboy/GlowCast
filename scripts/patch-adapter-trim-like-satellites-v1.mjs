import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const sideBySideTrimProportion =";
if (source.includes(marker)) {
  console.log("trim-like satellite proportion patch already applied");
  process.exit(0);
}

const anchor = `  if (!sideBySideTrim && !stackedTrim) return false;`;
const replacement = `  const sideBySideTrimProportion = satellite.width <= parent.width * 0.58;\n  const stackedTrimProportion = satellite.height <= parent.height * 0.58;\n  const trimLikeSatellite =\n    (sideBySideTrim && sideBySideTrimProportion) ||\n    (stackedTrim && stackedTrimProportion);\n  if (!trimLikeSatellite) return false;`;

if (!source.includes(anchor)) throw new Error("Unable to locate satellite orientation gate anchor");
source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("applied trim-like satellite proportion patch");
