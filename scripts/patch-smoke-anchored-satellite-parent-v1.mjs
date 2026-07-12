import fs from "node:fs/promises";

const smokePath = "scripts/smoke-satellite-merge-behavior.mjs";
let source = await fs.readFile(smokePath, "utf8");

const marker = "const cascadingTrim = groupNearbySatellites(";
if (source.includes(marker)) {
  console.log("anchored satellite parent smoke already applied");
  process.exit(0);
}

const anchor = `  console.log(\n    "Satellite behavior smoke passed: useful trim merges, thin fragments are rejected, repeated openings stay separate, ambiguous trim chooses the nearest parent, mixed-height trim chooses the matching opening, and stacked trim follows the strongest overlap."\n  );`;
const replacement = `  const cascadingTrim = groupNearbySatellites(\n    [\n      candidate("left_window", { x: 10, y: 20, width: 20, height: 30 }),\n      candidate("left_shutter", { x: 31, y: 20, width: 5, height: 30 }),\n      candidate("right_window", { x: 38, y: 20, width: 20, height: 30 })\n    ],\n    bounds\n  );\n\n  const anchoredLeft = cascadingTrim.find((mask) => mask.id === "left_window");\n  const anchoredRight = cascadingTrim.find((mask) => mask.id === "right_window");\n  if (\n    cascadingTrim.length !== 2 ||\n    !anchoredLeft ||\n    !covers(anchoredLeft.box, { x: 10, y: 20, width: 26, height: 30, tolerance: 0.1 }) ||\n    !anchoredRight ||\n    anchoredRight.box.x !== 38 ||\n    anchoredRight.box.y !== 20 ||\n    anchoredRight.box.width !== 20 ||\n    anchoredRight.box.height !== 30\n  ) {\n    console.error("Satellite behavior smoke failed. An expanded mask cascaded into a neighboring opening instead of staying anchored to its original geometry.");\n    console.error(JSON.stringify(cascadingTrim, null, 2));\n    process.exit(1);\n  }\n\n  console.log(\n    "Satellite behavior smoke passed: useful trim merges, thin fragments are rejected, repeated openings stay separate, ambiguous trim chooses the nearest parent, mixed-height trim chooses the matching opening, stacked trim follows the strongest overlap, and expanded masks cannot cascade into neighboring openings."\n  );`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate satellite behavior smoke summary anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(smokePath, source);
console.log("applied anchored satellite parent behavior smoke");
