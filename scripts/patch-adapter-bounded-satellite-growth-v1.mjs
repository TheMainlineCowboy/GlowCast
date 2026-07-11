import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "combined.width <= parent.width * 1.68";
if (source.includes(marker)) {
  console.log("bounded satellite growth patch already applied");
  process.exit(0);
}

const anchor = `  return (\n    combinedArea <= boundsArea * 0.42 &&`;
const replacement = `  const boundedCrossAxisGrowth =\n    (sideBySideTrim && combined.width <= parent.width * 1.68) ||\n    (stackedTrim && combined.height <= parent.height * 1.68);\n\n  return (\n    boundedCrossAxisGrowth &&\n    combinedArea <= boundsArea * 0.42 &&`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate satellite growth return anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("applied bounded satellite growth patch");
