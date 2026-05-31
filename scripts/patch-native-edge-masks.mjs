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

source = source.replace(
  '    setStep("mask");\n    setDetectMessage(message);',
  '    setStep("start");\n    setDetectMessage(message);'
);

source = source.replace(
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(false);\n          setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");',
  '          setSurfacePolygonMode(false);\n          setSurfacePolygonClosed(true);\n          setShowSurfaceHandles(true);\n          setSelectedTarget("surface");\n          setSelectedZoneId(null);\n          setDrawMode(false);\n          setDetectMessage("Projection surface closed. Review it, then tap Continue to Mask & Edit.");'
);

const functionAnchor = "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {";
const functionBody = `  function createMasksFromEdges() {
    if (!edgePoints.length) {
      setDetectMessage("Run the Edge Scanner first, then create edge mask candidates.");
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
      tolerance: 0.8,
      preferredShape: "auto"
    });

    const usable = autoMasks
      .map((mask, index) => {
        const shape = (mask.detectedShape ?? "rectangle") as MaskShape;
        return clampZone({
          id: Date.now() + index,
          x: mask.boundingBox.x,
          y: mask.boundingBox.y,
          width: mask.boundingBox.width,
          height: mask.boundingBox.height,
          included: false,
          label: "edge candidate",
          shape
        });
      })
      .filter((zone) => {
        if (zone.width < 2 || zone.height < 2) return false;
        if (!polygon) return true;
        const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        return pointInPolygon(center, polygon);
      })
      .slice(0, 24);

    if (!usable.length) {
      setDetectMessage("No usable edge mask candidates found inside the selected projection surface. Try tightening the projection outline around the object.");
      return;
    }

    setZones((current) => [
      ...current.filter((zone) => zone.label !== "edge mask" && zone.label !== "edge candidate"),
      ...usable
    ]);
    setSelectedTarget("zone");
    setSelectedZoneId(usable[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setDetectMessage("Found " + usable.length + " edge-outline mask candidates from scanned edges.");
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

const startBlockStart = '      {step === "start" && (';
const maskBlockStart = '      {step === "mask" && (';
const startStart = source.indexOf(startBlockStart);
const maskStart = source.indexOf(maskBlockStart);
if (startStart === -1 || maskStart === -1) throw new Error("Start surface workflow patch failed: step block anchors not found.");

const startBlock = `      {step === "start" && (
        imageUrl ? (
          <section className="workspace startSurfaceWorkspace">
            <aside className="toolPanel startSetupPanel">
              <div className="panelBlock">
                <h2>Projection Surface</h2>
                <p className="helperText">Set and adjust the projection surface before masking.</p>
                <button type="button" onClick={startSurfacePolygonMode} disabled={!imageUrl} className={surfacePolygonMode ? "activeStep" : ""}>
                  {surfacePolygonMode ? "Tap Surface Points" : surfacePolygonClosed ? "Redraw Projection Surface" : "Draw Projection Surface"}
                </button>
                <button type="button" onClick={resetSurfacePolygon} disabled={!surfacePolygonPoints.length}>Clear Projection Surface</button>
                <button type="button" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl}>{showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}</button>
                <button className="primary" type="button" onClick={() => { setShowSurfaceHandles(false); setResizeAction(null); setSelectedTarget("zone"); setSelectedZoneId(null); setStep("mask"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>
                <p className="helperText">
                  {surfacePolygonMode ? "Tap the photo to outline your projection surface. Close the shape by tapping your first point." : surfacePolygonClosed ? "Surface closed. Adjust/review it here, then continue to masking." : "Draw the projection surface on the photo."}
                </p>
              </div>
              <div className="panelBlock">
                <h2>Reference Photo</h2>
                <label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                <button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>
                <input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile} />
              </div>
            </aside>
            {stage}
          </section>
        ) : (
          <section className="startPage">
            <div className="startCard">
              <h2>Start with a reference photo</h2>
              <p>The photo is only for setup and alignment. The actual projection output will be animation or uploaded video only.</p>
              <label className="uploadButton"><ImagePlus size={20} /> Upload Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
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
            </div>
            <div className="startCard">
              <h2>Recent autosaves</h2>
              {recentProjects.length === 0 && <p className="helperText">No recent projects saved in this browser yet.</p>}
              <div className="recentProjectList">
                {recentProjects.map((project) => (
                  <button key={project.id} className="recentProjectButton" onClick={() => loadProject(project)}>
                    {project.thumbnailUrl || project.imageUrl ? <img src={project.thumbnailUrl ?? project.imageUrl ?? ""} alt={project.name} /> : <FolderOpen size={24} />}
                    <span><strong>{project.name}</strong><small>{project.savedAt ? new Date(project.savedAt).toLocaleString() : "Recent autosave"}</small></span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )
      )}

`;
source = source.slice(0, startStart) + startBlock + source.slice(maskStart);

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
console.log("native edge masks use auto outline shapes");