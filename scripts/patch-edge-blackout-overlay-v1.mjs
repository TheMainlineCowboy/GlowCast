import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

if (!s.includes("function renderEdgeBlackoutOverlay")) {
  s = s.replace('  function renderProjectionLayer(extra = "") {', [
    '  function renderEdgeBlackoutOverlay(extra = "") {',
    '    if (!showEdges || !edgeOverlayUrl || projectionOnly) return null;',
    '    const source = surfacePolygonClosed && surfacePolygonPoints.length >= 3',
    '      ? { polygon: surfacePolygonPoints, bounds: null }',
    '      : projectionArea ? { polygon: null, bounds: projectionArea } : null;',
    '    if (!source) return null;',
    '    const clipId = `edgeBlackoutClip-${extra || "main"}`;',
    '    const filterId = `edgeBlackoutFilter-${extra || "main"}`;',
    '    const polygonPoints = source.polygon ? source.polygon.map((point) => `${point.x},${point.y}`).join(" ") : "";',
    '    return (',
    '      <svg className={`edgeBlackoutOverlay ${extra}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9 }}>',
    '        <defs>',
    '          <clipPath id={clipId}>',
    '            {source.polygon ? (',
    '              <polygon points={polygonPoints} />',
    '            ) : source.bounds ? (',
    '              <rect x={source.bounds.x} y={source.bounds.y} width={source.bounds.width} height={source.bounds.height} />',
    '            ) : null}',
    '          </clipPath>',
    '          <filter id={filterId}>',
    '            <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="dilated" />',
    '            <feFlood floodColor="#000000" result="black" />',
    '            <feComposite in="black" in2="dilated" operator="in" />',
    '          </filter>',
    '        </defs>',
    '        <image href={edgeOverlayUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="none" clipPath={`url(#${clipId})`} filter={`url(#${filterId})`} opacity="1" />',
    '      </svg>',
    '    );',
    '  }',
    '',
    '  function renderProjectionLayer(extra = "") {'
  ].join("\n"));
}

s = s.replace(
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}',
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n          {renderEdgeBlackoutOverlay()}'
);

s = s.replace(
  'True scanner-path masks are active when the Edge Scanner is visible. Scanner points inside the projection surface now cut thicker scanner-edge paths directly.',
  'True scanner edge blackout is active when the Edge Scanner is visible. The scanner overlay is drawn as black no-projection geometry inside the projection surface.'
);

writeFileSync(appPath, s);
