import fs from "node:fs/promises";

const smokePath = "scripts/smoke-satellite-merge-behavior.mjs";
let source = await fs.readFile(smokePath, "utf8");

const marker = "const ambiguousTransom = groupNearbySatellites(";
if (source.includes(marker)) {
  console.log("overlap-aware stacked trim smoke already applied");
  process.exit(0);
}

const anchor = `  console.log(\n    "Satellite behavior smoke passed: useful trim merges, thin fragments are rejected, repeated openings stay separate, ambiguous trim chooses the nearest parent, and mixed-height trim chooses the matching opening."\n  );`;
const replacement = `  const ambiguousTransom = groupNearbySatellites(\n    [\n      candidate("wide_door", { x: 10, y: 18, width: 30, height: 48 }),\n      candidate("nearby_window", { x: 34, y: 26, width: 20, height: 30 }),\n      candidate("door_transom", { x: 24, y: 11, width: 22, height: 4 })\n    ],\n    bounds\n  );\n\n  const transomDoor = ambiguousTransom.find((mask) => mask.id === "wide_door");\n  const transomWindow = ambiguousTransom.find((mask) => mask.id === "nearby_window");\n  if (\n    ambiguousTransom.length !== 2 ||\n    !transomDoor ||\n    !covers(transomDoor.box, { x: 10, y: 11, width: 36, height: 55, tolerance: 0.1 }) ||\n    !transomWindow ||\n    transomWindow.box.x !== 34 ||\n    transomWindow.box.y !== 26 ||\n    transomWindow.box.width !== 20 ||\n    transomWindow.box.height !== 30\n  ) {\n    console.error("Satellite behavior smoke failed. A door transom attached to the neighboring window instead of the opening with stronger overlap.");\n    console.error(JSON.stringify(ambiguousTransom, null, 2));\n    process.exit(1);\n  }\n\n  console.log(\n    "Satellite behavior smoke passed: useful trim merges, thin fragments are rejected, repeated openings stay separate, ambiguous trim chooses the nearest parent, mixed-height trim chooses the matching opening, and stacked trim follows the strongest overlap."\n  );`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate satellite behavior smoke summary anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(smokePath, source);
console.log("applied overlap-aware stacked trim behavior smoke");
