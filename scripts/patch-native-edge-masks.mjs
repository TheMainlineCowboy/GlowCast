import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const oldImport = 'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
const newImport = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';

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

const startBlockStart = '      {step === "start" && (';
const maskBlockStart = '      {step === "mask" && (';
const contentBlockStart = '      {step === "content" && (';
const startStart = source.indexOf(startBlockStart);
const maskStart = source.indexOf(maskBlockStart);
const contentStart = source.indexOf(contentBlockStart);

if (startStart === -1 || maskStart === -1 || contentStart === -1) {
  throw new Error("Workflow patch failed: step block anchors not found.");
}

const newStartBlock = `      {step === "start" && (
        <section className={imageUrl ? "workspace startSurfaceWorkspace" : "startPage"}>
          <aside className="toolPanel startSetupPanel">
            <div className="panelBlock">
              <h2>Start with a reference photo</h2>
              <p className="helperText">The photo is only for setup and alignment. The actual projection output will be animation or uploaded video only.</p>
              <label className="uploadButton">
                <ImagePlus size={20} /> Upload Surface Photo
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
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
            <div className="panelBlock">
              <h2>Projection Surface</h2>
              <button type="button" onClick={startSurfacePolygonMode} disabled={!imageUrl} className={surfacePolygonMode ? "activeStep" : ""}>
                {surfacePolygonMode ? "Tap Surface Points" : surfacePolygonClosed ? "Redraw Projection Surface" : "Draw Projection Surface"}
              </button>
              <button type="button" onClick={resetSurfacePolygon} disabled={!surfacePolygonPoints.length}>Clear Projection Surface</button>
              <button type="button" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl}>{showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}</button>
              <button className="primary" type="button" onClick={() => { setShowSurfaceHandles(false); setResizeAction(null); setSelectedTarget("zone"); setSelectedZoneId(null); setStep("mask"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>
              <p className="helperText">
                {surfacePolygonMode ? "Tap the photo to outline your projection surface. Close the shape by tapping your first point." : surfacePolygonClosed ? "Surface set. Review it here, then continue to masking." : imageUrl ? "Draw the projection surface on the photo." : "Upload or choose a photo to begin."}
              </p>
            </div>
          </aside>
          {imageUrl ? stage : null}
        </section>
      )}

`;

const newMaskBlock = `      {step === "mask" && (
        <section className="workspace maskOnlyWorkspace">
          <aside className="toolPanel compactPanel">
            <div className="panelBlock">
              <h2>Avoid Masks</h2>
              <button type="button" onClick={() => { setShowSurfaceHandles(true); setSelectedTarget("surface"); setSelectedZoneId(null); setStep("start"); }}>Adjust Projection Surface</button>
              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>
              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>
              <div className="shapeToolRow">
                {shapeOptions.map((shape) => (
                  <button key={shape.id} className={drawShape === shape.id ? "activeEffect" : ""} onClick={() => { setDrawShape(shape.id); setDrawMode(true); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }}>
                    {shape.name}
                  </button>
                ))}
              </div>
              <button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl}>
                {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
                {drawMode ? ` + "`Drawing ${drawShape}`" + ` : "Draw Avoid Zone"}
              </button>
              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode}><Plus size={18} /> Add {drawShape} Zone</button>
              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject}>
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>
              <p className="helperText">{drawMode ? ` + "`Drag directly on the photo to draw a ${drawShape} avoid mask.`" + ` : detectMessage}</p>
            </div>
            <div className="panelBlock">
              <h2>Projection Logic</h2>
              <label className="toggle"><input type="checkbox" checked={invertMode} onChange={(event) => setInvertMode(event.target.checked)} /> Project around selected areas</label>
            </div>
          </aside>
          {stage}
          {selectedEditable && !projectionOnly && !cornerMode && !surfacePolygonMode && (
            <div className="zoneEditor">
              <strong>{selectedTarget === "surface" ? "Projection Surface" : ` + "`Zone ${zones.findIndex((zone) => zone.id === selectedZoneId) + 1}`" + `}</strong>
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key}>{key === "x" ? "X" : key === "y" ? "Y" : key[0].toUpperCase() + key.slice(1)}<input type="number" value={selectedEditable[key]} min={0} max={100} onChange={(event) => updateSelectedEditable({ [key]: Number(event.target.value) })} /></label>
              ))}
              {selectedTarget === "zone" && <button onClick={() => updateSelectedZone({ included: !selectedZone?.included })}>{selectedZone?.included ? "Included" : "Excluded"}</button>}
              {selectedTarget === "zone" && <button onClick={duplicateSelectedZone}>Duplicate</button>}
              {selectedTarget === "zone" && <button onClick={deleteSelectedZone}><Trash2 size={16} /> Delete</button>}
            </div>
          )}
          {selectedTarget === "zone" && selectedZone && !projectionOnly && !cornerMode && !surfacePolygonMode && (
            <div className="shapeEditor">
              {shapeOptions.map((shape) => (
                <button key={shape.id} className={selectedZone.shape === shape.id ? "activeEffect" : ""} onClick={() => updateSelectedZone({ shape: shape.id, label: ` + "`manual ${shape.id} avoid zone`" + `, points: undefined })}>{shape.name}</button>
              ))}
            </div>
          )}
        </section>
      )}

`;

source = source.slice(0, startStart) + newStartBlock + newMaskBlock + source.slice(contentStart);

writeFileSync(path, source);

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
