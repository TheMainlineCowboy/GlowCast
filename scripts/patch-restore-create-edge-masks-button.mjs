import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

source = source.replace(/Create Edge Masks/g, "Create Edge Mask Candidates");
writeFileSync(appPath, source);
