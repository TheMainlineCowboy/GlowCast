import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

text = text.replace('setStep("mask");', 'setStep("start");');

const clearSurfaceState = 'setShowSurfaceHandles(false); setSurfacePointAction(null); setResizeAction(null); setSelectedTarget("zone"); setSelectedZoneId(null);';

const startBlockStart = '      {step === "start" && (';
const startBlockEnd = '      {step === "mask" && (';
const startStart = text.indexOf(startBlockStart);
const startEnd = text.indexOf(startBlockEnd);
if (startStart === -1 || startEnd === -1 || startEnd <= startStart) throw new Error("Could not locate start workflow block.");

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
              <button className="primary" type="button" onClick={() => { ${clearSurfaceState} setStep("mask"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>
              <p className="helperText">
                {surfacePolygonMode ? "Tap the photo to outline your projection surface. Close the shape by tapping your first point." : surfacePolygonClosed ? "Surface set. Drag the yellow points to fine-tune the wall." : imageUrl ? "Draw the projection surface on the photo." : "Upload or choose a photo to begin."}
              </p>
            </div>
          </aside>
          {imageUrl ? stage : null}
        </section>
      )}

`;
text = text.slice(0, startStart) + newStartBlock + text.slice(startEnd);

const maskBlockStart = '      {step === "mask" && (';
const maskBlockEnd = '      {step === "content" && (';
const maskStart = text.indexOf(maskBlockStart);
const maskEnd = text.indexOf(maskBlockEnd);
if (maskStart === -1 || maskEnd === -1 || maskEnd <= maskStart) throw new Error("Could not locate mask workflow block.");

const newMaskBlock = `      {step === "mask" && (
        <section className="workspace maskOnlyWorkspace">
          <aside className="toolPanel compactPanel">
            <div className="panelBlock">
              <h2>Avoid Masks</h2>
              <button type="button" onClick={() => { setSurfacePointAction(null); setResizeAction(null); setShowSurfaceHandles(true); setSelectedTarget("surface"); setSelectedZoneId(null); setStep("start"); }}>Adjust Projection Surface</button>
              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning}>{edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}</button>
              <label className="toggle"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap</label>
              <div className="shapeToolRow">
                {shapeOptions.map((shape) => (
                  <button key={shape.id} className={drawShape === shape.id ? "activeEffect" : ""} onClick={() => { ${clearSurfaceState} setDrawShape(shape.id); setDrawMode(true); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }}>
                    {shape.name}
                  </button>
                ))}
              </div>
              <button onClick={() => { ${clearSurfaceState} setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl}>
                {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
                {drawMode ? "Drawing " + drawShape : "Draw Avoid Zone"}
              </button>
              <button onClick={() => { ${clearSurfaceState} addZone(drawShape); }} disabled={!imageUrl || cornerMode || surfacePolygonMode}><Plus size={18} /> Add {drawShape} Zone</button>
              <button type="button" onClick={() => setShowSetupLayers((current) => !current)} disabled={!imageUrl} className={!showSetupLayers ? "activeEffect" : ""}>
                {showSetupLayers ? "Hide Setup Layers" : "Show Setup Layers"}
              </button>
              <button type="button" onClick={() => setNightPreview((current) => !current)} disabled={!imageUrl} className={nightPreview ? "activeEffect" : ""}>
                {nightPreview ? "Day Preview" : "Night Preview"}
              </button>
              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject}>
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>
              <p className="helperText">{drawMode ? "Drag directly on the photo to draw a " + drawShape + " avoid mask." : "Add avoid masks for windows, doors, plants, signs, and anything the projector should skip."}</p>
            </div>
            <div className="panelBlock">
              <h2>Projection Logic</h2>
              <label className="toggle"><input type="checkbox" checked={invertMode} onChange={(event) => setInvertMode(event.target.checked)} /> Project around selected areas</label>
            </div>
          </aside>
          {stage}
        </section>
      )}

`;
text = text.slice(0, maskStart) + newMaskBlock + text.slice(maskEnd);

writeFileSync(path, text);
