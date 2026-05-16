import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

text = text.replaceAll(
  "{surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => (",
  "{step === \"start\" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => ("
);

writeFileSync(path, text);
