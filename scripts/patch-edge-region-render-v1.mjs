import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

s = s.replace(
  '  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);\n  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);',
  '  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);\n  const [edgeRegionUrl, setEdgeRegionUrl] = useState<string | null>(null);\n  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);'
);

s = s.replace(
  '    setEdgeOverlayUrl(null);\n    setEdgePoints([]);',
  '    setEdgeOverlayUrl(null);\n    setEdgeRegionUrl(null);\n    setEdgePoints([]);'
);

s = s.replace(
  '      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgePoints(result.edgePoints);',
  '      setEdgeOverlayUrl(result.edgeCanvasUrl);\n      setEdgeRegionUrl(result.edgeRegionCanvasUrl);\n      setEdgePoints(result.edgePoints);'
);

if (!s.includes("function renderEdgeRegionOverlay")) {
  s = s.replace('  function renderProjectionLayer(extra = "") {', [
    '  function renderEdgeRegionOverlay(extra = "") {',
    '    if (!showEdges || !edgeRegionUrl || projectionOnly) return null;',
    '    const source = surfacePolygonClosed && surfacePolygonPoints.length >= 3',
    '      ? { polygon: surfacePolygonPoints, bounds: null }',
    '      : projectionArea ? { polygon: null, bounds: projectionArea } : null;',
    '    if (!source) return null;',
    '    const clipId = `edgeRegionClip-${extra || "main"}`;',
    '    const polygonPoints = source.polygon ? source.polygon.map((point) => `${point.x},${point.y}`).join(" ") : "";',
    '    return (',
    '      <svg className={`edgeRegionOverlay ${extra}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9 }}>',
    '        <defs>',
    '          <clipPath id={clipId}>',
    '            {source.polygon ? (',
    '              <polygon points={polygonPoints} />',
    '            ) : source.bounds ? (',
    '              <rect x={source.bounds.x} y={source.bounds.y} width={source.bounds.width} height={source.bounds.height} />',
    '            ) : null}',
    '          </clipPath>',
    '        </defs>',
    '        <image href={edgeRegionUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="none" clipPath={`url(#${clipId})`} opacity="1" />',
    '      </svg>',
    '    );',
    '  }',
    '',
    '  function renderProjectionLayer(extra = "") {'
  ].join("\n"));
}

s = s.replace(
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n          {null}',
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n          {renderEdgeRegionOverlay()}'
);

s = s.replace(
  'Scanner blackout overlay is disabled. The edge scanner remains visible, but true filled edge masks need a safer contour/fill pass.',
  'Scanner contour fill is active when the Edge Scanner is visible. Filled enclosed scanner regions are drawn as no-projection geometry inside the projection surface.'
);

writeFileSync(p, s);
