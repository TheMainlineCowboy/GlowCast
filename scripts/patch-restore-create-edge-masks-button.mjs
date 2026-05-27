import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

source = source.replace(/Create Edge Masks/g, "Create Edge Mask Candidates");
source = source.replace('included: true,\n        label: "edge contour mask"', 'included: false,\n        label: "edge candidate"');
source = source.replace(/edge fallback mask/g, "edge candidate");

writeFileSync(appPath, source);
