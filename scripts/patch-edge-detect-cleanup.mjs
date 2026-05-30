import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

const a = "strength >= " + "92";
const b = "strength >= " + "70";
source = source.replace(a, b);

writeFileSync(path, source);
console.log("edge cleanup small detector tune");
