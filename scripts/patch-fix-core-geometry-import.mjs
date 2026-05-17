import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

const badImport = 'import { zoneToGeometryPoints, type MaskShape } from "./core/geometry";';
const goodImport = 'import { zoneToGeometryPoints } from "./core/geometry";';

text = text.split(badImport).join(goodImport);

writeFileSync(appPath, text);
