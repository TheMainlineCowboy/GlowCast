import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

if (!text.includes("const [showMaskOutlines")) {
  text = text.replace(
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showMaskOutlines, setShowMaskOutlines] = useState(true);"
  );
}

if (!text.includes("type SurfacePointAction")) {
  text = text.replace(
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};",
    "type ResizeAction = {\n  target: EditTarget;\n  id: number;\n  mode: ResizeMode;\n  startX: number;\n  startY: number;\n  original: ProjectZone;\n};\n\ntype SurfacePointAction = {\n  index: number;\n  startX: number;\n  startY: number;\n  originalPoints: SurfacePoint[];\n};"
  );
}

if (!text.includes("const [surfacePointAction")) {
  text = text.replace(
    "  const [surfacePolygonClosed, setSurfacePolygonClosed] = useState(false);",
    "  const [surfacePolygonClosed, setSurfacePolygonClosed] = useState(false);\n  const [surfacePointAction, setSurfacePointAction] = useState<SurfacePointAction | null>(null);"
  );
}

if (!text.includes("function startSurfacePointDrag")) {
  text = text.replace(
    "  function resetSurfacePolygon() {",
    "  function startSurfacePointDrag(event: React.PointerEvent<HTMLElement>, index: number) {\n    const point = getPoint(event, false);\n    if (!point) return;\n    event.preventDefault();\n    event.stopPropagation();\n    setSelectedTarget(\"surface\");\n    setSelectedZoneId(null);\n    setDrawMode(false);\n    setCornerMode(false);\n    setSurfacePolygonMode(false);\n    setProjectionOnly(false);\n    setSurfacePointAction({ index, startX: point.x, startY: point.y, originalPoints: surfacePolygonPoints.map((p) => ({ ...p })) });\n    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);\n  }\n\n  function applySurfacePointDrag(action: SurfacePointAction, point: SurfacePoint) {\n    const dx = point.x - action.startX;\n    const dy = point.y - action.startY;\n    setSurfacePolygonPoints(action.originalPoints.map((original, index) => (\n      index === action.index ? { x: Number(clamp(original.x + dx).toFixed(2)), y: Number(clamp(original.y + dy).toFixed(2)) } : original\n    )));\n    setSurfacePolygonClosed(true);\n    setDetectMessage(\"Projection surface point adjusted.\");\n  }\n\n  function resetSurfacePolygon() {"
  );
}

text = text.replace("    if (resizeAction) return;", "    if (resizeAction || surfacePointAction) return;");

if (!text.includes("if (surfacePointAction)")) {
  text = text.replace(
    "    if (resizeAction) {\n      applyResize(resizeAction, point);\n      return;\n    }",
    "    if (surfacePointAction) {\n      applySurfacePointDrag(surfacePointAction, point);\n      return;\n    }\n    if (resizeAction) {\n      applyResize(resizeAction, point);\n      return;\n    }"
  );
}

text = text.replace("    setResizeAction(null);", "    setResizeAction(null);\n    setSurfacePointAction(null);");
text = text.replace("    setSelectedZoneId(id);\n  }", "    setSelectedZoneId(id);\n    setDrawMode(false);\n  }");
text = text.replace("    if (rect.width < 2 || rect.height < 2) return;", "    if (rect.width < 2 || rect.height < 2) { setDrawMode(false); return; }");
text = text.replace("    setSelectedTarget(\"zone\");\n    setSelectedZoneId(id);\n  }\n\n  async function openProjectorMode", "    setSelectedTarget(\"zone\");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n  }\n\n  async function openProjectorMode");

if (!text.includes("surfacePointHandle")) {
  text = text.replace(
    "    return (\n      <svg className=\"surfacePolygonOverlay\" viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 7 }}>",
    "    return (\n      <>\n      <svg className=\"surfacePolygonOverlay\" viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 7 }}>"
  );
  text = text.replace(
    "        {surfacePolygonPoints.map((point, index) => (\n          <circle key={index} cx={point.x} cy={point.y} r={index === 0 ? 1.2 : 0.8} fill={index === 0 ? \"#facc15\" : \"#fef08a\"} />\n        ))}\n      </svg>",
    "        {surfacePolygonPoints.map((point, index) => (\n          <circle key={index} cx={point.x} cy={point.y} r={index === 0 ? 1.2 : 0.8} fill={index === 0 ? \"#facc15\" : \"#fef08a\"} />\n        ))}\n      </svg>\n      {surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => (\n        <button key={\"surface-point-\" + index} type=\"button\" className=\"surfacePointHandle\" onPointerDown={(event) => startSurfacePointDrag(event, index)} aria-label={\"Move surface point \" + (index + 1)} style={{ left: point.x + \"%\", top: point.y + \"%\" }} />\n      ))}\n      </>"
  );
}

text = text.replaceAll("{zone.shape === \"triangle\" ? (", "{showMaskOutlines && zone.shape === \"triangle\" ? (");
text = text.replaceAll("{(zone.shape === \"circle\" || zone.shape === \"oval\") ? (", "{showMaskOutlines && (zone.shape === \"circle\" || zone.shape === \"oval\") ? (");
text = text.replaceAll("{zone.shape === \"freehand\" ? (", "{showMaskOutlines && zone.shape === \"freehand\" ? (");
text = text.replaceAll("{renderHandles(\"zone\", zone)}", "{showMaskOutlines ? renderHandles(\"zone\", zone) : null}");

if (!text.includes("Hide Mask Outlines")) {
  text = text.replace(
    "              <button type=\"button\" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl} >\n                {showSurfaceHandles ? \"Hide Surface Handles\" : \"Show Surface Handles\"}\n              </button>",
    "              <button type=\"button\" onClick={() => setShowSurfaceHandles((current) => !current)} disabled={!imageUrl} >\n                {showSurfaceHandles ? \"Hide Surface Handles\" : \"Show Surface Handles\"}\n              </button>\n              <button type=\"button\" onClick={() => setShowMaskOutlines((current) => !current)} disabled={!imageUrl} >\n                {showMaskOutlines ? \"Hide Mask Outlines\" : \"Show Mask Outlines\"}\n              </button>"
  );
}

writeFileSync(path, text);
