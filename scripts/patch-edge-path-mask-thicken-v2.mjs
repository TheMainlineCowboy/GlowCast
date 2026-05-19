import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

s = s.replaceAll('r="0.34" fill="black"', 'r="1.05" fill="black"');
s = s.replaceAll('edge points inside the projection surface now cut projection paths directly.', 'edge points inside the projection surface now cut thicker scanner-edge paths directly.');

writeFileSync(appPath, s);
