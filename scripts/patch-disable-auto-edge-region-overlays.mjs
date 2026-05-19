import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

s = s.replaceAll('{renderEdgeRegionOverlay()}', '{null}');
s = s.replaceAll('{renderEdgeBlackoutOverlay()}', '{null}');

s = s.replace(
  'Scanner contour fill is active when the Edge Scanner is visible. Filled enclosed scanner regions are drawn as no-projection geometry inside the projection surface.',
  'Automatic edge-region masking is disabled. The edge scanner remains available for visual detection while manual masks remain safe and editable.'
);

s = s.replace(
  'True scanner edge blackout is active when the Edge Scanner is visible. The scanner overlay is drawn as black no-projection geometry inside the projection surface.',
  'Automatic edge-region masking is disabled. The edge scanner remains available for visual detection while manual masks remain safe and editable.'
);

s = s.replace(
  'True scanner-path masks are active when the Edge Scanner is visible. Scanner points inside the projection surface now cut thicker scanner-edge paths directly.',
  'Automatic edge-region masking is disabled. The edge scanner remains available for visual detection while manual masks remain safe and editable.'
);

writeFileSync(appPath, s);
