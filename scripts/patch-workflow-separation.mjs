import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

const maskBlockStart = '      {step === "mask" && (';
const maskBlockEnd = '      {step === "content" && (';
const start = text.indexOf(maskBlockStart);
const end = text.indexOf(maskBlockEnd);
if (start === -1 || end === -1 || end <= start) {
  throw new Error("Could not locate mask workflow block.");
}

const replacement = `      {step === "mask" && (
        <section className="workspace workflowSeparated">
          <aside className="toolPanel compactPanel">
            <div className="panelBlock surfaceSetupOnly">
              <h2>Surface Setup</h2>
              <button type="button" onClick={startSurfacePolygonMode} disabled={!imageUrl} className={surfacePolygonMode ? "activeStep" : ""} >
                {surfacePolygonMode ? "Tap Surface Points" : surfacePolygonClosed ? "Redraw Projection Surface" : "Draw Projection Surface"}
              </button>
              <button type="button" onClick={resetSurfacePolygon} disabled={!surfacePolygonPoints.length} >
                Clear Projection Surface
              </button>
              <button type="button" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl} >
                {showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}
              </button>
              <button className="primary" type="button" onClick={() => setStep("content")} disabled={!surfacePolygonClosed && !projectionArea} >
                Continue to Content
              </button>
              <p className="helperText">
                {surfacePolygonMode ? "Tap the photo to outline your projection surface. Close the shape by tapping your first point." : surfacePolygonClosed ? "Projection surface set. Drag yellow points to fine-tune the wall, then continue." : detectMessage}
              </p>
            </div>
            <div className="panelBlock maskToolsOnly">
              <h2>Avoid Masks</h2>
              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning}>
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>
              <label className="toggle">
                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap
              </label>
              <div className="shapeToolRow">
                {shapeOptions.map((shape) => (
                  <button key={shape.id} className={drawShape === shape.id ? "activeEffect" : ""} onClick={() => { setDrawShape(shape.id); setDrawMode(true); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} >
                    {shape.name}
                  </button>
                ))}
              </div>
              <button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); setCornerMode(false); setCornerPoints([]); setSurfacePolygonMode(false); }} disabled={!imageUrl} >
                {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
                {drawMode ? \`Drawing \${drawShape}\` : "Draw Avoid Zone"}
              </button>
              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode} >
                <Plus size={18} /> Add {drawShape} Zone
              </button>
              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject} >
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>
              <p className="helperText">
                {drawMode ? \`Drag directly on the photo to draw a \${drawShape} avoid mask.\` : "Add avoid masks for windows, doors, plants, signs, and anything the projector should skip."}
              </p>
            </div>
            <div className="panelBlock maskToolsOnly">
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
                {selectedTarget === "surface" ? "Projection Surface" : \`Zone \${zones.findIndex((zone) => zone.id === selectedZoneId) + 1}\`}
              </strong>
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key}>
                  {key === "x" ? "X" : key === "y" ? "Y" : key[0].toUpperCase() + key.slice(1)}
                  <input type="number" value={selectedEditable[key]} min={0} max={100} onChange={(event) => updateSelectedEditable({ [key]: Number(event.target.value) })} />
                </label>
              ))}
              {selectedTarget === "zone" && (
                <button onClick={() => updateSelectedZone({ included: !selectedZone?.included })} >
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
                <button key={shape.id} className={selectedZone.shape === shape.id ? "activeEffect" : ""} onClick={() => updateSelectedZone({ shape: shape.id, label: \`manual \${shape.id} avoid zone\`, points: undefined })} >
                  {shape.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

`;

text = text.slice(0, start) + replacement + text.slice(end);
writeFileSync(path, text);
