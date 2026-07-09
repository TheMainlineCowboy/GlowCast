import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldBlock = `  const combined = mergeBoxes(parent, satellite);
  const combinedArea = combined.width * combined.height;
  const boundsArea = bounds.width * bounds.height;
  const aspect = combined.width / Math.max(combined.height, 0.01);

  return combinedArea <= boundsArea * 0.42 && aspect >= 0.18 && aspect <= 5.2;
`;

const newBlock = `  const combined = mergeBoxes(parent, satellite);
  const combinedArea = combined.width * combined.height;
  const boundsArea = bounds.width * bounds.height;
  const aspect = combined.width / Math.max(combined.height, 0.01);
  const parentFillRatio = parentArea / Math.max(combinedArea, 1);
  const satelliteFillRatio = satelliteArea / Math.max(combinedArea, 1);

  // Satellite grouping should pull shutters/trim into a real parent opening, not
  // turn one strong mask plus a distant fragment into an inflated random box.
  return (
    combinedArea <= boundsArea * 0.42 &&
    aspect >= 0.18 &&
    aspect <= 5.2 &&
    parentFillRatio >= 0.56 &&
    satelliteFillRatio >= 0.08
  );
`;

if (!source.includes("parentFillRatio")) {
  if (!source.includes(oldBlock)) {
    throw new Error("satellite merge inflation gate target not found");
  }
  source = source.replace(oldBlock, newBlock);
  await fs.writeFile(path, source);
  console.log("patched satellite merge inflation gate");
} else {
  console.log("satellite merge inflation gate already present");
}
