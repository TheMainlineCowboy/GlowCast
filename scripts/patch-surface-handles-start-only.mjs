import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

text = text.replaceAll(
  "{surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => (",
  "{step === \"start\" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => ("
);

text = text.replaceAll(
  "{step === \"start\" && step === \"start\" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => (",
  "{step === \"start\" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => ("
);

text = text.replace(
  "{projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? (",
  "{step === \"start\" && projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? ("
);

text = text.replaceAll(
  "{step === \"start\" && step === \"start\" && projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? (",
  "{step === \"start\" && projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? ("
);

writeFileSync(path, text);
