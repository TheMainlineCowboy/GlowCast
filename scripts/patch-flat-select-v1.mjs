import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

function insertBefore(marker, block) {
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`Missing marker: ${marker}`);
  text = text.slice(0, index) + block + text.slice(index);
}

if (!text.includes("type FlatDragAction")) {
  text = text.replace(
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};",
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};\n\ntype FlatDragAction = { id: number; startX: number; startY: number; original: ProjectZone; };\ntype FlatResizeAction = { id: number; mode: ResizeMode; startX: number; startY: number; original: ProjectZone; };"
  );
}

if (!text.includes("type FlatResizeAction")) {
  text = text.replace(
    "type FlatDragAction = { id: number; startX: number; startY: number; original: ProjectZone; };",
    "type FlatDragAction = { id: number; startX: number; startY: number; original: ProjectZone; };\ntype FlatResizeAction = { id: number; mode: ResizeMode; startX: number; startY: number; original: ProjectZone; };"
  );
}

if (!text.includes("const [flatDragAction")) {
  text = text.replace(
    "  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);",
    "  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);\n  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);\n  const [flatResizeAction, setFlatResizeAction] = useState<FlatResizeAction | null>(null);"
  );
}

if (!text.includes("const [flatResizeAction")) {
  text = text.replace(
    "  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);",
    "  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);\n  const [flatResizeAction, setFlatResizeAction] = useState<FlatResizeAction | null>(null);"
  );
}

if (!text.includes("function getFlatPoint")) {
  insertBefore(
    "  function getPoint(event: React.PointerEvent, allowSnap = true) {",
    `  function getFlatPoint(event: React.PointerEvent<HTMLElement>) {
    const stage = event.currentTarget.closest(".flatViewStage") as HTMLElement | null;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) };
  }

  function startFlatMaskDrag(event: React.PointerEvent<HTMLElement>, zone: ProjectZone) {
    const point = getFlatPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedTarget("zone");
    setSelectedZoneId(zone.id);
    setFlatResizeAction(null);
    setFlatDragAction({ id: zone.id, startX: point.x, startY: point.y, original: { ...zone } });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function startFlatMaskResize(event: React.PointerEvent<HTMLElement>, zone: ProjectZone, mode: ResizeMode) {
    const point = getFlatPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedTarget("zone");
    setSelectedZoneId(zone.id);
    setFlatDragAction(null);
    setFlatResizeAction({ id: zone.id, mode, startX: point.x, startY: point.y, original: { ...zone } });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function applyFlatMaskDrag(action: FlatDragAction, point: { x: number; y: number }) {
    const dx = point.x - action.startX;
    const dy = point.y - action.startY;
    const update = (zone: ProjectZone) => zone.id === action.id ? clampZonePositionOnly({ ...zone, x: action.original.x + dx, y: action.original.y + dy }) : zone;
    setZones((current) => current.map(update));
    setFlattenedPreviewZones((current) => current.map(update));
  }

  function getFlatResizedZone(action: FlatResizeAction, point: { x: number; y: number }) {
    const dx = point.x - action.startX;
    const dy = point.y - action.startY;
    let x = action.original.x;
    let y = action.original.y;
    let width = action.original.width;
    let height = action.original.height;
    if (action.mode.includes("e")) width += dx;
    if (action.mode.includes("s")) height += dy;
    if (action.mode.includes("w")) { x += dx; width -= dx; }
    if (action.mode.includes("n")) { y += dy; height -= dy; }
    if (action.original.shape === "circle") {
      const size = Math.max(2, Math.min(Math.abs(width), Math.abs(height)));
      width = size;
      height = size;
      if (action.mode.includes("w")) x = action.original.x + action.original.width - size;
      if (action.mode.includes("n")) y = action.original.y + action.original.height - size;
    }
    return clampZone({ ...action.original, x, y, width, height });
  }

  function applyFlatMaskResize(action: FlatResizeAction, point: { x: number; y: number }) {
    const resized = getFlatResizedZone(action, point);
    const update = (zone: ProjectZone) => zone.id === action.id ? { ...zone, x: resized.x, y: resized.y, width: resized.width, height: resized.height } : zone;
    setZones((current) => current.map(update));
    setFlattenedPreviewZones((current) => current.map(update));
  }

`
  );
}

if (!text.includes("function handleFlatPointerMove")) {
  insertBefore(
    "  function finishPointerAction() {",
    `  function handleFlatPointerMove(event: React.PointerEvent<HTMLElement>) {
    const point = getFlatPoint(event);
    if (!point) return;
    if (flatResizeAction) {
      applyFlatMaskResize(flatResizeAction, point);
      return;
    }
    if (flatDragAction) applyFlatMaskDrag(flatDragAction, point);
  }

  function finishFlatPointerAction() {
    setFlatDragAction(null);
    setFlatResizeAction(null);
  }

`
  );
}

const flatStart = '      {step === "flat" && (';
const contentStart = '      {step === "content" && (';
const start = text.indexOf(flatStart);
const end = text.indexOf(contentStart);
if (start === -1 || end === -1 || end <= start) throw new Error("Flat View block not found.");

const flatBlock = `      {step === "flat" && (
        <section className="workspace flatViewShell">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Flat View</h2>
              <button type="button" onClick={generateFlattenedSurfacePreview} disabled={!imageUrl || surfacePolygonPoints.length < 4}>Refresh Flat View</button>
              <button type="button" onClick={() => setStep("start")}>Back to Surface Setup</button>
              <button type="button" onClick={() => setStep("mask")}>Back to Mask Tools</button>
              {selectedZone ? (
                <div className="flatSelectionBox">
                  <strong>Selected Mask {zones.findIndex((zone) => zone.id === selectedZone.id) + 1}</strong>
                  <span>{selectedZone.shape ?? "rectangle"}</span>
                  <button type="button" onClick={() => { setSelectedTarget("zone"); setSelectedZoneId(selectedZone.id); setStep("mask"); }}>Edit This Mask on Page 2</button>
                </div>
              ) : (
                <p className="helperText">Tap a mask overlay to select it. Drag it here for quick flat-view positioning.</p>
              )}
            </div>
          </aside>
          <div className="flattenPreviewPanel flatViewPanel">
            {flattenedSurfaceUrl ? (
              <div className="flattenPreviewStage flatViewStage" onPointerMove={handleFlatPointerMove} onPointerUp={finishFlatPointerAction} onPointerCancel={finishFlatPointerAction}>
                <img src={flattenedSurfaceUrl} alt="Flattened surface" />
                {flattenedPreviewZones.map((zone, index) => (
                  <button type="button" key={zone.id + "-flat-view-" + index} className={"flattenPreviewMask flatPreviewSelectable " + shapeClass(zone.shape) + (selectedZoneId === zone.id ? " selectedFlatMask" : "")} style={toStyle(zone)} onPointerDown={(event) => startFlatMaskDrag(event, zone)}>
                    <span>{index + 1}</span>
                    {selectedZoneId === zone.id ? ["nw", "ne", "se", "sw"].map((handle) => (
                      <i key={handle} className={"flatResizeHandle flat-handle-" + handle} onPointerDown={(event) => startFlatMaskResize(event, zone, handle as ResizeMode)} />
                    )) : null}
                  </button>
                ))}
              </div>
            ) : <div className="flattenPreviewEmpty">Generate a flattened preview first.</div>}
            <p className="helperText">{flattenedSurfaceMessage}</p>
          </div>
        </section>
      )}

`;
text = text.slice(0, start) + flatBlock + text.slice(end);

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes("flatPreviewSelectable")) css += "\n.flatPreviewSelectable{pointer-events:auto!important;cursor:pointer!important;padding:0!important;margin:0!important;color:#020617!important;font:inherit!important;text-align:left!important;appearance:none!important}.flatPreviewSelectable span{pointer-events:none!important}.selectedFlatMask{border-color:#67e8f9!important;box-shadow:0 0 0 3px rgba(103,232,249,.55),0 0 24px rgba(103,232,249,.5)!important}.flatSelectionBox{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(103,232,249,.35);border-radius:14px;background:rgba(2,6,23,.45)}.flatSelectionBox span{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.08em}\n";
if (!css.includes("flat-view drag v1")) css += "\n/* flat-view drag v1 */\n.flatViewStage{touch-action:none}.flatPreviewSelectable:active{cursor:grabbing!important}.selectedFlatMask{z-index:8!important}\n";
if (!css.includes("flat-view resize v1")) css += "\n/* flat-view resize v1 */\n.flatResizeHandle{position:absolute;width:18px;height:18px;border-radius:999px;background:#67e8f9;border:3px solid #020617;box-shadow:0 0 0 2px #fff,0 0 16px rgba(103,232,249,.7);z-index:12;pointer-events:auto!important}.flat-handle-nw{left:-9px;top:-9px;cursor:nwse-resize}.flat-handle-ne{right:-9px;top:-9px;cursor:nesw-resize}.flat-handle-se{right:-9px;bottom:-9px;cursor:nwse-resize}.flat-handle-sw{left:-9px;bottom:-9px;cursor:nesw-resize}@media(max-width:960px){.flatResizeHandle{width:22px;height:22px}.flat-handle-nw{left:-11px;top:-11px}.flat-handle-ne{right:-11px;top:-11px}.flat-handle-se{right:-11px;bottom:-11px}.flat-handle-sw{left:-11px;bottom:-11px}}\n";
writeFileSync(cssPath, css);
