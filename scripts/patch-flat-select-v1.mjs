import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

if (!text.includes("type FlatDragAction")) {
  text = text.replace(
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};",
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};\n\ntype FlatDragAction = {\n  id: number;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};\n\ntype FlatResizeAction = {\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};"
  );
} else if (!text.includes("type FlatResizeAction")) {
  text = text.replace(
    "type FlatDragAction = {\n  id: number;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};",
    "type FlatDragAction = {\n  id: number;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};\n\ntype FlatResizeAction = {\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};"
  );
}

if (!text.includes("const [flatDragAction")) {
  text = text.replace(
    "  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);",
    "  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);\n  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);\n  const [flatResizeAction, setFlatResizeAction] = useState<FlatResizeAction | null>(null);"
  );
} else if (!text.includes("const [flatResizeAction")) {
  text = text.replace(
    "  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);",
    "  const [flatDragAction, setFlatDragAction] = useState<FlatDragAction | null>(null);\n  const [flatResizeAction, setFlatResizeAction] = useState<FlatResizeAction | null>(null);"
  );
}

if (!text.includes("function getFlatPoint")) {
  text = text.replace(
    "  function getPoint(event: React.PointerEvent, allowSnap = true) {",
    "  function getFlatPoint(event: React.PointerEvent<HTMLElement>) {\n    const stage = event.currentTarget.closest(\".flatViewStage\") as HTMLElement | null;\n    if (!stage) return null;\n    const rect = stage.getBoundingClientRect();\n    return {\n      x: clamp(((event.clientX - rect.left) / rect.width) * 100),\n      y: clamp(((event.clientY - rect.top) / rect.height) * 100)\n    };\n  }\n\n  function startFlatMaskDrag(event: React.PointerEvent<HTMLElement>, zone: ProjectZone) {\n    const point = getFlatPoint(event);\n    if (!point) return;\n    event.preventDefault();\n    event.stopPropagation();\n    setSelectedTarget(\"zone\");\n    setSelectedZoneId(zone.id);\n    setFlatResizeAction(null);\n    setFlatDragAction({ id: zone.id, startX: point.x, startY: point.y, original: { ...zone } });\n    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);\n  }\n\n  function startFlatMaskResize(event: React.PointerEvent<HTMLElement>, zone: ProjectZone, mode: ResizeMode) {\n    const point = getFlatPoint(event);\n    if (!point) return;\n    event.preventDefault();\n    event.stopPropagation();\n    setSelectedTarget(\"zone\");\n    setSelectedZoneId(zone.id);\n    setFlatDragAction(null);\n    setFlatResizeAction({ id: zone.id, mode, startX: point.x, startY: point.y, original: { ...zone } });\n    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);\n  }\n\n  function applyFlatMaskDrag(action: FlatDragAction, point: { x: number; y: number }) {\n    const dx = point.x - action.startX;\n    const dy = point.y - action.startY;\n    const update = (zone: ProjectZone) => zone.id === action.id ? clampZonePositionOnly({ ...zone, x: action.original.x + dx, y: action.original.y + dy }) : zone;\n    setZones((current) => current.map(update));\n    setFlattenedPreviewZones((current) => current.map(update));\n  }\n\n  function getFlatResizedZone(action: FlatResizeAction, point: { x: number; y: number }) {\n    const dx = point.x - action.startX;\n    const dy = point.y - action.startY;\n    let x = action.original.x;\n    let y = action.original.y;\n    let width = action.original.width;\n    let height = action.original.height;\n    if (action.mode.includes(\"e\")) width += dx;\n    if (action.mode.includes(\"s\")) height += dy;\n    if (action.mode.includes(\"w\")) { x += dx; width -= dx; }\n    if (action.mode.includes(\"n\")) { y += dy; height -= dy; }\n    if (action.original.shape === \"circle\") {\n      const size = Math.max(2, Math.min(Math.abs(width), Math.abs(height)));\n      width = size;\n      height = size;\n      if (action.mode.includes(\"w\")) x = action.original.x + action.original.width - size;\n      if (action.mode.includes(\"n\")) y = action.original.y + action.original.height - size;\n    }\n    return clampZone({ ...action.original, x, y, width, height });\n  }\n\n  function applyFlatMaskResize(action: FlatResizeAction, point: { x: number; y: number }) {\n    const resized = getFlatResizedZone(action, point);\n    setZones((current) => current.map((zone) => zone.id === action.id ? { ...zone, x: resized.x, y: resized.y, width: resized.width, height: resized.height } : zone));\n    setFlattenedPreviewZones((current) => current.map((zone) => zone.id === action.id ? { ...zone, x: resized.x, y: resized.y, width: resized.width, height: resized.height } : zone));\n  }\n\n  function getPoint(event: React.PointerEvent, allowSnap = true) {"
  );
} else {
  if (!text.includes("function startFlatMaskResize")) {
    text = text.replace(
      "  function applyFlatMaskDrag(action: FlatDragAction, point: { x: number; y: number }) {",
      "  function startFlatMaskResize(event: React.PointerEvent<HTMLElement>, zone: ProjectZone, mode: ResizeMode) {\n    const point = getFlatPoint(event);\n    if (!point) return;\n    event.preventDefault();\n    event.stopPropagation();\n    setSelectedTarget(\"zone\");\n    setSelectedZoneId(zone.id);\n    setFlatDragAction(null);\n    setFlatResizeAction({ id: zone.id, mode, startX: point.x, startY: point.y, original: { ...zone } });\n    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);\n  }\n\n  function applyFlatMaskDrag(action: FlatDragAction, point: { x: number; y: number }) {"
    );
  }
  if (!text.includes("function applyFlatMaskResize")) {
    text = text.replace(
      "  function getPoint(event: React.PointerEvent, allowSnap = true) {",
      "  function getFlatResizedZone(action: FlatResizeAction, point: { x: number; y: number }) {\n    const dx = point.x - action.startX;\n    const dy = point.y - action.startY;\n    let x = action.original.x;\n    let y = action.original.y;\n    let width = action.original.width;\n    let height = action.original.height;\n    if (action.mode.includes(\"e\")) width += dx;\n    if (action.mode.includes(\"s\")) height += dy;\n    if (action.mode.includes(\"w\")) { x += dx; width -= dx; }\n    if (action.mode.includes(\"n\")) { y += dy; height -= dy; }\n    if (action.original.shape === \"circle\") {\n      const size = Math.max(2, Math.min(Math.abs(width), Math.abs(height)));\n      width = size;\n      height = size;\n      if (action.mode.includes(\"w\")) x = action.original.x + action.original.width - size;\n      if (action.mode.includes(\"n\")) y = action.original.y + action.original.height - size;\n    }\n    return clampZone({ ...action.original, x, y, width, height });\n  }\n\n  function applyFlatMaskResize(action: FlatResizeAction, point: { x: number; y: number }) {\n    const resized = getFlatResizedZone(action, point);\n    setZones((current) => current.map((zone) => zone.id === action.id ? { ...zone, x: resized.x, y: resized.y, width: resized.width, height: resized.height } : zone));\n    setFlattenedPreviewZones((current) => current.map((zone) => zone.id === action.id ? { ...zone, x: resized.x, y: resized.y, width: resized.width, height: resized.height } : zone));\n  }\n\n  function getPoint(event: React.PointerEvent, allowSnap = true) {"
    );
  }
}

if (!text.includes("if (flatResizeAction)")) {
  text = text.replace(
    "  function handleFlatPointerMove(event: React.PointerEvent<HTMLElement>) {\n    if (!flatDragAction) return;\n    const point = getFlatPoint(event);\n    if (!point) return;\n    applyFlatMaskDrag(flatDragAction, point);\n  }\n\n  function finishFlatPointerAction() {\n    setFlatDragAction(null);\n  }",
    "  function handleFlatPointerMove(event: React.PointerEvent<HTMLElement>) {\n    const point = getFlatPoint(event);\n    if (!point) return;\n    if (flatResizeAction) {\n      applyFlatMaskResize(flatResizeAction, point);\n      return;\n    }\n    if (flatDragAction) {\n      applyFlatMaskDrag(flatDragAction, point);\n    }\n  }\n\n  function finishFlatPointerAction() {\n    setFlatDragAction(null);\n    setFlatResizeAction(null);\n  }"
  );
}

const flatStart = '      {step === "flat" && (';
const contentStart = '      {step === "content" && (';
const start = text.indexOf(flatStart);
const end = text.indexOf(contentStart);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Flat View block not found. Make sure patch-flat-view-shell runs before patch-flat-select-v1.");
}

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
if (!css.includes("flatPreviewSelectable")) {
  css += `
.flatPreviewSelectable{pointer-events:auto!important;cursor:pointer!important;padding:0!important;margin:0!important;color:#020617!important;font:inherit!important;text-align:left!important;appearance:none!important}.flatPreviewSelectable span{pointer-events:none!important}.selectedFlatMask{border-color:#67e8f9!important;box-shadow:0 0 0 3px rgba(103,232,249,.55),0 0 24px rgba(103,232,249,.5)!important}.flatSelectionBox{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(103,232,249,.35);border-radius:14px;background:rgba(2,6,23,.45)}.flatSelectionBox span{color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
`;
}
if (!css.includes("flat-view drag v1")) {
  css += `
/* flat-view drag v1 */
.flatViewStage{touch-action:none}.flatPreviewSelectable:active{cursor:grabbing!important}.selectedFlatMask{z-index:8!important}
`;
}
if (!css.includes("flat-view resize v1")) {
  css += `
/* flat-view resize v1 */
.flatResizeHandle{position:absolute;width:18px;height:18px;border-radius:999px;background:#67e8f9;border:3px solid #020617;box-shadow:0 0 0 2px #fff,0 0 16px rgba(103,232,249,.7);z-index:12;pointer-events:auto!important}.flat-handle-nw{left:-9px;top:-9px;cursor:nwse-resize}.flat-handle-ne{right:-9px;top:-9px;cursor:nesw-resize}.flat-handle-se{right:-9px;bottom:-9px;cursor:nwse-resize}.flat-handle-sw{left:-9px;bottom:-9px;cursor:nesw-resize}@media(max-width:960px){.flatResizeHandle{width:22px;height:22px}.flat-handle-nw{left:-11px;top:-11px}.flat-handle-ne{right:-11px;top:-11px}.flat-handle-se{right:-11px;bottom:-11px}.flat-handle-sw{left:-11px;bottom:-11px}}
`;
}
writeFileSync(cssPath, css);
