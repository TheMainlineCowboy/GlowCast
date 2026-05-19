import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

s = s.replaceAll('{renderEdgeBlackoutOverlay()}', '{null}');
s = s.replace(
  'True scanner edge blackout is active when the Edge Scanner is visible. The scanner overlay is drawn as black no-projection geometry inside the projection surface.',
  'Scanner blackout overlay is disabled. The edge scanner remains visible, but true filled edge masks need a safer contour/fill pass.'
);

writeFileSync(appPath, s);
