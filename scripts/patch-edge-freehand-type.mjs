import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

app = app.replaceAll('shape: "freehand",', 'shape: "freehand" as MaskShape,');

writeFileSync(path, app);
console.log("typed freehand edge masks as MaskShape");
