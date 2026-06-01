import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

app = app.replace(
  "  const stage = (\n    <div className={`stage ${projectionOnly ? \"projectionOnly\" : \"\"}`}>\n",
  "  const stageProjectionReady = step !== \"start\";\n\n  const stage = (\n    <div className={`stage ${projectionOnly ? \"projectionOnly\" : \"\"}`}>\n"
);

app = app.replace(
  "          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}",
  "          {stageProjectionReady && surfacePolygonClosed ? renderPolygonProjectionLayer() : null}"
);

app = app.replace(
  "          {invertMode && projectionArea && !surfacePolygonClosed && (",
  "          {stageProjectionReady && invertMode && projectionArea && !surfacePolygonClosed && ("
);

app = app.replace(
  "          {invertMode && includedZones.map((zone) => (",
  "          {stageProjectionReady && invertMode && includedZones.map((zone) => ("
);

app = app.replace(
  "          {!invertMode && includedZones.map((zone) => (",
  "          {stageProjectionReady && !invertMode && includedZones.map((zone) => ("
);

writeFileSync(path, app);
