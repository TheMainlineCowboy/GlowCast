import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const oldImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
const contourImport = 'import { generateContourMasks } from "./edgeContour";\n';
const newImport = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';

source = source.replace(contourImport, "");
if (source.includes(oldImport)) {
  source = source.replace(oldImport, newImport);
} else if (!source.includes(newImport)) {
  throw new Error("Native edge mask patch failed: edgeDetect import anchor was not found.");
}

source = source.replace('setStep("mask");', 'setStep("start");');
source = source.replace(
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(false);\n          setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");',
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(true);\n          setSelectedTarget("surface");\n          setSelectedZoneId(null);\n          setDrawMode(false);\n          setDetectMessage("Projection surface closed. Review it, then tap Continue to Mask & Edit.");'
);

const functionAnchor = "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {";
const functionBody = `  function createMasksFromEdges() {
    if (!edgePoints.length) {
      setDetectMessage("Run the Edge Scanner first, then create edge masks.");
      return;
    }

    const polygon = surfacePolygonClosed && surfacePolygonPoints.length >= 3 ? surfacePolygonPoints : null;
    const bounds = polygon
      ? {
          x: Math.min(...polygon.map((point) => point.x)),
          y: Math.min(...polygon.map((point) => point.y)),
          width: Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)),
          height: Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y))
        }
      : projectionArea ?? { x: 0, y: 0, width: 100, height: 100 };

    const pointInPolygon = (point: SurfacePoint, points: SurfacePoint[]) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;
        const crosses = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.00001) + xi;
        if (crosses) inside = !inside;
      }
      return inside;
    };

    const autoMasks = generateAutoMasks(edgePoints, bounds, {
      clusterRadius: 1.6,
      minPoints: 18,
      tolerance: 0.8
    });

    const usable = autoMasks
      .map((mask, index) => clampZone({
        id: Date.now() + index,
        x: mask.boundingBox.x,
        y: mask.boundingBox.y,
        width: mask.boundingBox.width,
        height: mask.boundingBox.height,
        included: true,
        label: "edge mask",
        shape: "rectangle" as MaskShape
      }))
      .filter((zone) => {
        if (zone.width < 2 || zone.height < 2) return false;
        if (!polygon) return true;
        const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        return pointInPolygon(center, polygon);
      })
      .slice(0, 24);

    if (!usable.length) {
      setDetectMessage("No usable edge masks found inside the selected projection surface. Try tightening the projection outline around the windows.");
      return;
    }

    setZones((current) => [
      ...current.filter((zone) => zone.label !== "edge mask"),
      ...usable
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setDetectMessage("Created " + usable.length + " edge masks from scanned edges.");
  }

`;

if (source.includes("function createMasksFromEdges()")) {
  const start = source.indexOf("  function createMasksFromEdges()");
  const end = source.indexOf(functionAnchor, start);
  if (start === -1 || end === -1) throw new Error("Native edge mask patch failed: could not replace existing createMasksFromEdges block.");
  source = source.slice(0, start) + functionBody + source.slice(end);
} else {
  if (!source.includes(functionAnchor)) throw new Error("Native edge mask patch failed: resetForPhoto anchor was not found.");
  source = source.replace(functionAnchor, functionBody + functionAnchor);
}

const cssPath = "styles.css";
if (existsSync(cssPath)) {
  let css = readFileSync(cssPath, "utf8");
  const mobileGuard = `

/* Native mobile start overflow guard */
@media(max-width:960px){
  html,body,#root{max-width:100vw!important;overflow-x:hidden!important;}
  .appShell,.glowcastApp{width:100%!important;max-width:100vw!important;overflow-x:hidden!important;}
  .startPage,.startSurfaceWorkspace{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
  .startCard,.startSetupPanel{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
  .startCard *,.startSetupPanel *{max-width:100%!important;}
  .startCard .uploadButton,.startCard button,.startSetupPanel button{width:100%!important;max-width:100%!important;min-width:0!important;white-space:normal!important;overflow:hidden!important;}
  .recentPhotoBlock,.recentHeader,.recentPhotoRow,.recentProjectList{width:100%!important;max-width:100%!important;min-width:0!important;}
  .recentPhotoRow{overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;}
  .startCard button.recentPhotoButton,.startSetupPanel button.recentPhotoButton{flex:0 0 92px!important;min-width:92px!important;max-width:92px!important;}
}
`;
  if (!css.includes("Native mobile start overflow guard")) {
    css += mobileGuard;
    writeFileSync(cssPath, css);
  }
}

writeFileSync(path, source);
