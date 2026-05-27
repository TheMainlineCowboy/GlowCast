import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

const button = `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>`;

const maskStart = source.indexOf('{step === "mask" && (');
if (maskStart === -1) throw new Error("Mask panel not found.");

const magneticIndex = source.indexOf('<label className="flex items-center gap-2 text-sm text-slate-200">', maskStart);
if (magneticIndex === -1) throw new Error("Magnetic snap label not found in mask panel.");

const maskChunk = source.slice(maskStart, magneticIndex);
if (!maskChunk.includes("onClick={createMasksFromEdges}")) {
  source = source.slice(0, magneticIndex) + button + "\n" + source.slice(magneticIndex);
}

const functionStart = source.indexOf("  function createMasksFromEdges()");
const functionEndAnchor = "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {";
const functionEnd = source.indexOf(functionEndAnchor, functionStart);
if (functionStart === -1 || functionEnd === -1) throw new Error("createMasksFromEdges function block not found.");

const contourFunction = `  function createMasksFromEdges() {
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

    const autoMasks = generateContourMasks(edgePoints, bounds);

    const usable = autoMasks
      .map((mask, index) => clampZone({
        id: Date.now() + index,
        x: mask.boundingBox.x,
        y: mask.boundingBox.y,
        width: mask.boundingBox.width,
        height: mask.boundingBox.height,
        included: true,
        label: "edge contour mask",
        shape: "freehand" as MaskShape,
        points: mask.points
      }))
      .filter((zone) => {
        if (zone.width < 2 || zone.height < 2) return false;
        if (!polygon) return true;
        const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        return pointInPolygon(center, polygon);
      })
      .slice(0, 10);

    if (!usable.length) {
      setDetectMessage("No usable connected edge clusters found inside the selected projection surface.");
      return;
    }

    setZones((current) => [
      ...current.filter((zone) => zone.label !== "edge contour mask" && zone.label !== "edge mask"),
      ...usable
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setDetectMessage("Created " + usable.length + " connected edge masks from visible edge paths.");
  }

`;

source = source.slice(0, functionStart) + contourFunction + source.slice(functionEnd);
writeFileSync(appPath, source);
