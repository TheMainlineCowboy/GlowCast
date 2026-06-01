import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

const helper = `
const polygonBounds = (points: SurfacePoint[]): Zone | null => {
  if (points.length < 3) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    id: -1,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(Math.max(1, right - x).toFixed(2)),
    height: Number(Math.max(1, bottom - y).toFixed(2)),
    included: true,
    label: "projection surface"
  };
};
`;

if (!app.includes("const polygonBounds = (points: SurfacePoint[])")) {
  app = app.replace("const flattenedSurface = (): Zone => ({", `${helper}\nconst flattenedSurface = (): Zone => ({`);
}

app = app.replace(
  "  const projectionArea = surfaceZone;",
  "  const polygonProjectionArea = surfacePolygonClosed ? polygonBounds(surfacePolygonPoints) : null;\n  const projectionArea = surfaceZone ?? polygonProjectionArea;"
);

app = app.replace(
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(false);\n          setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");',
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setStep("mask");\n          setProjectionOnly(false);\n          setShowSurfaceHandles(false);\n          setDetectMessage("Projection surface polygon set. Use Edge Scanner, Edge-only View, or Create Edge Mask Candidates inside this selected area.");'
);

if (!app.includes("Create Edge Mask Candidates")) {
  throw new Error("Edge candidate buttons were not installed before surface polygon fallback patch ran.");
}

app = app.replace(
  'disabled={!imageUrl || !projectionArea || edgeScanning}',
  'disabled={!imageUrl || !projectionArea || edgeScanning}'
);

writeFileSync(path, app);
console.log("surface polygon now counts as projection area for edge candidate creation and stays on mask page");
