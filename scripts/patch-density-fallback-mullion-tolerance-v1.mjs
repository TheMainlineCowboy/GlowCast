import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const horizontalMullionGutter = widthCells >= 13 ? 2 : widthCells >= 9 ? 1 : 0;")) {
  console.log("Density fallback extra-thick mullion tolerance already present.");
} else {
  const currentGutter = `          const horizontalMullionGutter = widthCells >= 9 ? 1 : 0;
          const verticalMullionGutter = heightCells >= 10 ? 1 : 0;`;
  const scaledGutter = `          const horizontalMullionGutter = widthCells >= 13 ? 2 : widthCells >= 9 ? 1 : 0;
          const verticalMullionGutter = heightCells >= 14 ? 2 : heightCells >= 10 ? 1 : 0;`;

  if (!source.includes(currentGutter)) {
    throw new Error("Density fallback scaled mullion-gutter anchor not found.");
  }

  source = source.replace(currentGutter, scaledGutter);
  await fs.writeFile(path, source);
  console.log("Scaled pane gutters for extra-thick center bars while preserving minimum pane area.");
}
