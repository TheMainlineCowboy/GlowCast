import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

// Loading or selecting a photo should keep the user on Start.
// Start is where the projection surface is drawn and confirmed.
const resetForPhotoStep = `    resetEdgeScanner();
    setStep("mask");
    setDetectMessage(message);`;
const resetForPhotoStart = `    resetEdgeScanner();
    setStep("start");
    setDetectMessage(message);`;
if (app.includes(resetForPhotoStep)) {
  app = app.replace(resetForPhotoStep, resetForPhotoStart);
}

// If any earlier patch tried to auto-advance after closing a polygon, stop it.
app = app.replaceAll(
  `setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");
          setStep("mask");`,
  `setDetectMessage("Projection surface set. Review it, then tap Continue to Mask & Edit.");`
);
app = app.replaceAll(
  `setDetectMessage("Projection surface polygon set. Draw avoid masks inside the selected area.");`,
  `setDetectMessage("Projection surface set. Review it, then tap Continue to Mask & Edit.");`
);

const startBlockStart = '      {step === "start" && (';
const maskBlockStart = '      {step === "mask" && (';
const startStart = app.indexOf(startBlockStart);
const startEnd = app.indexOf(maskBlockStart);
if (startStart === -1 || startEnd === -1 || startEnd <= startStart) {
  throw new Error("Start surface flow patch failed: could not locate Start block.");
}

const startBlock = String.raw`      {step === "start" && (
        <section className={imageUrl ? "workspace startSurfaceWorkspace" : "startPage"}>
          <aside className="toolPanel startSetupPanel">
            <div className="panelBlock">
              <h2>Start with a reference photo</h2>
              <p className="helperText">
                The photo is only for setup and alignment. The actual projection output will be animation or uploaded video only.
              </p>
              <label className="uploadButton">
                <ImagePlus size={20} /> Upload Surface Photo
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
              {visibleRecentPhotos.length > 0 && (
                <div className="recentPhotoBlock">
                  <div className="recentHeader">
                    <strong>Recent Photos</strong>
                    <span>Tap to reuse</span>
                  </div>
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
              <button onClick={() => importProjectRef.current?.click()}>
                <FolderOpen size={18} /> Load Project File
              </button>
              <input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile} />
            </div>

            {imageUrl && (
              <div className="panelBlock surfaceSetupBlock">
                <h2>Projection Surface</h2>
                <button type="button" onClick={startSurfacePolygonMode} className={surfacePolygonMode ? "activeStep" : ""}>
                  {surfacePolygonMode ? "Tap Surface Points" : projectionArea ? "Redraw Projection Surface" : "Draw Projection Surface"}
                </button>
                <button type="button" onClick={resetSurfacePolygon} disabled={!surfacePolygonPoints.length && !surfaceZone}>
                  Clear Projection Surface
                </button>
                <button type="button" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!projectionArea}>
                  {showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    setProjectionOnly(false);
                    setDrawMode(false);
                    setCornerMode(false);
                    setCornerPoints([]);
                    setSurfacePolygonMode(false);
                    setShowSurfaceHandles(false);
                    setSelectedTarget("zone");
                    setSelectedZoneId(null);
                    setDetectMessage("Projection surface locked. Now create or draw avoid masks.");
                    setStep("mask");
                  }}
                  disabled={!projectionArea}
                >
                  Continue to Mask & Edit
                </button>
                <p className="helperText">
                  {surfacePolygonMode
                    ? "Tap around the surface. Tap the first point again to close it."
                    : projectionArea
                      ? "Surface is set. Fine-tune the yellow outline, then continue."
                      : "Draw the projection surface before moving to masks."}
                </p>
              </div>
            )}
          </aside>

          {imageUrl ? (
            stage
          ) : (
            <div className="startCard">
              <h2>Recent autosaves</h2>
              {recentProjects.length === 0 && (
                <p className="helperText">
                  No recent projects saved in this browser yet.
                </p>
              )}
              <div className="recentProjectList">
                {recentProjects.map((project) => (
                  <button key={project.id} className="recentProjectButton" onClick={() => loadProject(project)}>
                    {project.thumbnailUrl || project.imageUrl ? (
                      <img src={project.thumbnailUrl ?? project.imageUrl ?? ""} alt={project.name} />
                    ) : (
                      <FolderOpen size={24} />
                    )}
                    <span>
                      <strong>{project.name}</strong>
                      <small>
                        {project.savedAt ? new Date(project.savedAt).toLocaleString() : "Recent autosave"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

`;
app = app.slice(0, startStart) + startBlock + app.slice(startEnd);

const contentBlockStart = '      {step === "content" && (';
const maskStart = app.indexOf(maskBlockStart);
const maskEnd = app.indexOf(contentBlockStart);
if (maskStart === -1 || maskEnd === -1 || maskEnd <= maskStart) {
  throw new Error("Start surface flow patch failed: could not locate Mask block.");
}

const maskBlock = String.raw`      {step === "mask" && (
        <section className="workspace maskOnlyWorkspace">
          <aside className="toolPanel compactPanel">
            <div className="panelBlock">
              <h2>Avoid Masks</h2>
              <button type="button" onClick={() => { setShowSurfaceHandles(true); setProjectionOnly(false); setEdgeOnlyMode(false); setDrawMode(false); setSurfacePolygonMode(false); setSelectedTarget("surface"); setSelectedZoneId(null); setStep("start"); }}>
                Adjust Projection Surface
              </button>
              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning}>
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>
              <button type="button" onClick={toggleEdgeOnlyMode} disabled={!imageUrl || edgeScanning}>
                {edgeOnlyMode ? "Show Photo View" : "Edge-only View"}
              </button>
              <button type="button" onClick={createEdgeMaskCandidates} disabled={!imageUrl || !projectionArea || edgeScanning}>
                Create Edge Mask Candidates
              </button>
              <button className="primary" onClick={applySelectedEdgeCandidate} disabled={selectedZone?.label !== "edge candidate"}>
                Apply Selected Candidate
              </button>
              <button type="button" onClick={applyAllEdgeCandidates} disabled={!edgeCandidateZones().length}>
                Apply All Candidates
              </button>
              <button type="button" onClick={clearEdgeCandidates} disabled={!edgeCandidateZones().length}>
                Clear Candidates
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>
              <div className="edgeDebugPanel"><strong>Edge Debug</strong><span>edge points: {edgePoints.length.toLocaleString()}</span><span>candidates: {edgeCandidateZones().length}</span><span>projection: {projectionArea ? "ready" : "not set"}</span></div>
              <div className="shapeToolRow">
                {shapeOptions.map((shape) => (
                  <button key={shape.id} className={drawShape === shape.id ? "activeEffect" : ""} onClick={() => { setDrawShape(shape.id); setDrawMode(true); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }}>
                    {shape.name}
                  </button>
                ))}
              </div>
              <button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl}>
                {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
                {drawMode ? "Drawing " + drawShape : "Draw Avoid Zone"}
              </button>
              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode}>
                <Plus size={18} /> Add {drawShape} Zone
              </button>

              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject}>
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>

              <p className="helperText">
                {drawMode ? "Drag directly on the photo to draw a " + drawShape + " avoid mask." : detectMessage}
              </p>
            </div>
            <div className="panelBlock">
              <h2>Projection Logic</h2>
              <label className="toggle">
                <input type="checkbox" checked={invertMode} onChange={(event) => setInvertMode(event.target.checked)} /> Project around selected areas
              </label>
            </div>
          </aside>
          {stage}
          {selectedEditable && !projectionOnly && !cornerMode && !surfacePolygonMode && (
            <div className="zoneEditor">
              <strong>
                {selectedTarget === "surface" ? "Projection Surface" : "Zone " + (zones.findIndex((zone) => zone.id === selectedZoneId) + 1)}
              </strong>
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key}>
                  {key === "x" ? "X" : key === "y" ? "Y" : key[0].toUpperCase() + key.slice(1)}
                  <input type="number" value={selectedEditable[key]} min={0} max={100} onChange={(event) => updateSelectedEditable({ [key]: Number(event.target.value) })} />
                </label>
              ))}
              {selectedTarget === "zone" && (
                <button onClick={() => updateSelectedZone({ included: !selectedZone?.included })}>
                  {selectedZone?.included ? "Included" : "Excluded"}
                </button>
              )}
              {selectedTarget === "zone" && (
                <button onClick={duplicateSelectedZone}>Duplicate</button>
              )}
              {selectedTarget === "zone" && (
                <button onClick={deleteSelectedZone}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          )}
          {selectedTarget === "zone" && selectedZone && !projectionOnly && !cornerMode && !surfacePolygonMode && (
            <div className="shapeEditor">
              {shapeOptions.map((shape) => (
                <button key={shape.id} className={selectedZone.shape === shape.id ? "activeEffect" : ""} onClick={() => updateSelectedZone({ shape: shape.id, label: "manual " + shape.id + " avoid zone", points: undefined })}>
                  {shape.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

`;
app = app.slice(0, maskStart) + maskBlock + app.slice(maskEnd);

writeFileSync(appPath, app);

let css = readFileSync("styles.css", "utf8");
if (!css.includes("startSurfaceWorkspace")) {
  css += `
.startSurfaceWorkspace{align-items:start}.startSetupPanel{min-width:0}.surfaceSetupBlock .primary{margin-top:4px}.maskOnlyWorkspace .toolPanel{align-self:start}@media(max-width:960px){.startSurfaceWorkspace,.maskOnlyWorkspace{grid-template-columns:1fr!important}.startSurfaceWorkspace .stage,.maskOnlyWorkspace .stage{min-width:0!important;width:100%!important}.startSetupPanel{width:100%!important;max-width:100%!important}.toolPanel{min-width:0!important}.stepNav{position:static!important}.glowcastApp header{position:static!important}}
`;
}
writeFileSync("styles.css", css);

console.log("start page now owns photo setup and projection surface confirmation");
