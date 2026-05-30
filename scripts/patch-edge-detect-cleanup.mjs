import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

writeFileSync(path, source);
console.log("edge detector stable baseline restored");
