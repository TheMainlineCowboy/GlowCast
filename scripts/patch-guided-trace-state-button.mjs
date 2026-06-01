import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

app = app.replace(
  /\n\s*<button type="button" onClick=\{\(\) => \{ setEdgeTraceMode\(true\);[\s\S]*?Trace Edge Mask[\s\S]*?<\/button>/,
  ""
);

writeFileSync(appPath, app);
console.log("failed guided trace button disabled");
