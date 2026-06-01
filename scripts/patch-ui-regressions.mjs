import { readFileSync, writeFileSync } from "node:fs";

let app = readFileSync("src/App.tsx", "utf8");

const oneEdgeState = '  const [edgeOnlyMode, setEdgeOnlyMode] = useState(false);';
const first = app.indexOf(oneEdgeState);
if (first !== -1) {
  const before = app.slice(0, first + oneEdgeState.length);
  const after = app.slice(first + oneEdgeState.length).split('\n' + oneEdgeState).join('');
  app = before + after;
}

if (app.includes('  const projectionArea = surfaceZone;')) {
  app = app.replace('  const projectionArea = surfaceZone;', [
    '  const polygonProjectionArea = useMemo<Zone | null>(() => {',
    '    if (!surfacePolygonClosed || surfacePolygonPoints.length < 3) return null;',
    '    const xs = surfacePolygonPoints.map((point) => point.x);',
    '    const ys = surfacePolygonPoints.map((point) => point.y);',
    '    const minX = Math.min(...xs);',
    '    const maxX = Math.max(...xs);',
    '    const minY = Math.min(...ys);',
    '    const maxY = Math.max(...ys);',
    '    return clampZone({ id: -1, x: minX, y: minY, width: maxX - minX, height: maxY - minY, included: true, label: "projection surface" });',
    '  }, [surfacePolygonClosed, surfacePolygonPoints]);',
    '  const projectionArea = surfaceZone ?? polygonProjectionArea;'
  ].join('\n'));
}

app = app.split('{surfacePolygonClosed ? renderPolygonProjectionLayer() : null}').join('{surfacePolygonClosed && projectionOnly ? renderPolygonProjectionLayer() : null}');
app = app.split('{surfacePolygonClosed && !edgeOnlyMode ? renderPolygonProjectionLayer() : null}').join('{surfacePolygonClosed && projectionOnly ? renderPolygonProjectionLayer() : null}');
app = app.split('          {showEdges && edgeOverlayUrl && !projectionOnly ? (').join('          {showEdges && edgeOverlayUrl && !projectionOnly && !edgeOnlyMode ? (');
app = app.split('!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map').join('!projectionOnly && !edgeOnlyMode && !cornerMode && !surfacePolygonMode && zones.map');
app = app.split('projectionArea && showSurfaceHandles && !projectionOnly').join('projectionArea && showSurfaceHandles && !projectionOnly && !edgeOnlyMode');
app = app.split('draftRect && !projectionOnly').join('draftRect && !projectionOnly && !edgeOnlyMode');

const oldImg = '          {imageUrl && (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          )}';
const newImg = '          {edgeOnlyMode && edgeOverlayUrl ? (\n            <img className="referencePhoto edgeOnlyStage" src={edgeOverlayUrl} alt="Scanned edge layer" draggable={false} />\n          ) : imageUrl ? (\n            <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false} />\n          ) : null}';
app = app.split(oldImg).join(newImg);

if (app.includes('Create Edge Mask Candidates') && !app.includes('edgeDebugPanel')) {
  const anchor = '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>';
  const debug = anchor + '\n              <div className="edgeDebugPanel"><strong>Edge Debug</strong><span>edge points: {edgePoints.length.toLocaleString()}</span><span>candidates: {edgeCandidateZones().length}</span><span>projection: {projectionArea ? "ready" : "not set"}</span></div>';
  app = app.split(anchor).join(debug);
}

writeFileSync("src/App.tsx", app);

let css = readFileSync("styles.css", "utf8");
if (!css.includes('edgeDebugPanel')) {
  css += '\n.edgeDebugPanel{display:grid;gap:3px;margin:8px 0 12px;padding:10px 12px;border:1px solid rgba(103,232,249,.35);background:rgba(2,6,23,.55);border-radius:14px;color:#cbd5e1;font-size:12px}.edgeDebugPanel strong{color:#67e8f9;text-transform:uppercase;letter-spacing:.08em}.edgeOnlyStage{opacity:1!important;background:#020617!important}@media(max-width:960px){html,body,#root,.glowcastApp{max-width:100vw!important;overflow-x:hidden!important}.startPage{grid-template-columns:1fr!important;width:100%!important;max-width:100vw!important;overflow:hidden!important}.startCard{width:100%!important;max-width:100%!important;min-width:0!important;padding:14px!important;overflow:hidden!important}.recentPhotoRow{max-width:100%!important;overflow-x:auto!important}.recentPhotoButton{flex:0 0 86px!important;min-width:86px!important;max-width:86px!important}.workspace{grid-template-columns:1fr!important}}\n';
}
writeFileSync("styles.css", css);

console.log("stabilized edge UI and restored debug panel");
