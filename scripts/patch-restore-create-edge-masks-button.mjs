import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

const referenceBlock = `              <div className="panelBlock">
                <h2>Reference Photo</h2>
                <label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                <button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>
                <input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile} />
              </div>`;

const referenceBlockWithRecent = `              <div className="panelBlock">
                <h2>Reference Photo</h2>
                <label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                {visibleRecentPhotos.length > 0 && (
                  <div className="recentPhotoBlock">
                    <div className="recentHeader"><strong>Recent Photos</strong><span>Tap to reuse</span></div>
                    <div className="recentPhotoRow">
                      {visibleRecentPhotos.map((photo) => (
                        <button key={photo.id} className="recentPhotoButton" onClick={() => loadRecentPhoto(photo)} title={photo.name}>
                          <img src={photo.thumbnailUrl} alt={photo.name} />
                          <span>{photo.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>
                <input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile} />
              </div>`;

if (source.includes(referenceBlock)) source = source.replace(referenceBlock, referenceBlockWithRecent);

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
      .slice(0, 8);

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

const contourPath = "src/edgeContour.ts";
let contour = readFileSync(contourPath, "utf8");
contour = contour.replace("for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)M(g,W,Hh,gx+x,gy+y)", "for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)M(g,W,Hh,gx+x,gy+y)");
contour = contour.replace("for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)M(d,W,Hh,x+xx,y+yy)", "for(let yy=-3;yy<=3;yy++)for(let xx=-3;xx<=3;xx++)M(d,W,Hh,x+xx,y+yy)");
contour = contour.replace("if(cells.length<18)return null;", "if(cells.length<14)return null;");
contour = contour.replace("if(b.width<z.width*.045||b.height<z.height*.055||area<za*.003||area>za*.3||asp<.22||asp>4.8)return null;", "if(b.width<z.width*.07||b.height<z.height*.09||area<za*.01||area>za*.28||asp<.35||asp>3.6)return null;");
contour = contour.replace("if(acc.length>=10)break", "if(acc.length>=8)break");
writeFileSync(contourPath, contour);
