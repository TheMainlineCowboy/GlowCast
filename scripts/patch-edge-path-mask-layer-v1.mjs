import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let s = readFileSync(appPath, "utf8");

if (!s.includes("function edgeMaskSourceArea")) {
  s = s.replace('  function renderProjectionLayer(extra = "") {', [
    '  function edgeMaskSourceArea() {',
    '    if (surfacePolygonClosed && surfacePolygonPoints.length >= 3) {',
    '      return {',
    '        polygon: surfacePolygonPoints,',
    '        bounds: {',
    '          x: Math.min(...surfacePolygonPoints.map((point) => point.x)),',
    '          y: Math.min(...surfacePolygonPoints.map((point) => point.y)),',
    '          width: Math.max(...surfacePolygonPoints.map((point) => point.x)) - Math.min(...surfacePolygonPoints.map((point) => point.x)),',
    '          height: Math.max(...surfacePolygonPoints.map((point) => point.y)) - Math.min(...surfacePolygonPoints.map((point) => point.y))',
    '        }',
    '      };',
    '    }',
    '    return projectionArea ? { polygon: null, bounds: projectionArea } : null;',
    '  }',
    '',
    '  function pointInsidePolygon(point: Point, polygon: Point[]) {',
    '    let inside = false;',
    '    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {',
    '      const xi = polygon[i].x;',
    '      const yi = polygon[i].y;',
    '      const xj = polygon[j].x;',
    '      const yj = polygon[j].y;',
    '      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi;',
    '      if (intersect) inside = !inside;',
    '    }',
    '    return inside;',
    '  }',
    '',
    '  function edgeMaskPoints(limit = 2600) {',
    '    const source = edgeMaskSourceArea();',
    '    if (!source || !edgePoints.length) return [];',
    '    const { bounds, polygon } = source;',
    '    const scoped = edgePoints.filter((point) => {',
    '      const inBounds = point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;',
    '      return inBounds && (!polygon || pointInsidePolygon(point, polygon));',
    '    });',
    '    if (scoped.length <= limit) return scoped;',
    '    const step = Math.max(1, Math.ceil(scoped.length / limit));',
    '    return scoped.filter((_, index) => index % step === 0);',
    '  }',
    '',
    '  function renderEdgePathProjectionLayer(extra = "") {',
    '    if (!invertMode || !edgePoints.length) return null;',
    '    const source = edgeMaskSourceArea();',
    '    if (!source) return null;',
    '    const points = edgeMaskPoints(extra ? 1800 : 2600);',
    '    if (!points.length) return null;',
    '    const maskId = `edgePathMask-${extra || "main"}`;',
    '    const polygonPoints = source.polygon ? source.polygon.map((point) => `${point.x},${point.y}`).join(" ") : "";',
    '    return (',
    '      <svg className={`edgePathMaskLayer ${extra}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}>',
    '        <defs>',
    '          <mask id={maskId}>',
    '            <rect x="0" y="0" width="100" height="100" fill="black" />',
    '            {source.polygon ? (',
    '              <polygon points={polygonPoints} fill="white" />',
    '            ) : (',
    '              <rect x={source.bounds.x} y={source.bounds.y} width={source.bounds.width} height={source.bounds.height} fill="white" />',
    '            )}',
    '            {includedZones.map((zone) => (',
    '              <rect key={`emz-${zone.id}`} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />',
    '            ))}',
    '            {points.map((point, index) => (',
    '              <circle key={`ep-${index}`} cx={point.x} cy={point.y} r="0.34" fill="black" />',
    '            ))}',
    '          </mask>',
    '        </defs>',
    '        <foreignObject x="0" y="0" width="100" height="100" mask={`url(#${maskId})`}>',
    '          <div className="edgePathMaskForeign" style={{ width: "100%", height: "100%" }}>',
    '            {renderProjectionLayer(extra || "edgePathProjectionEffect")}',
    '          </div>',
    '        </foreignObject>',
    '      </svg>',
    '    );',
    '  }',
    '',
    '  function renderProjectionLayer(extra = "") {'
  ].join("\n"));
}

s = s.replace(
  '          {invertMode && surfacePolygonClosed ? (\n            renderPolygonProjectionLayer("projectorPolygonEffect")\n          ) : invertMode && projectionArea ? (\n            <div className="projectionSurface" style={toStyle(projectionArea)}>\n              {renderProjectionLayer("projectorEffect")}\n            </div>\n          ) : null}',
  '          {invertMode && edgePoints.length ? (\n            renderEdgePathProjectionLayer("projectorEdgePathEffect")\n          ) : invertMode && surfacePolygonClosed ? (\n            renderPolygonProjectionLayer("projectorPolygonEffect")\n          ) : invertMode && projectionArea ? (\n            <div className="projectionSurface" style={toStyle(projectionArea)}>\n              {renderProjectionLayer("projectorEffect")}\n            </div>\n          ) : null}'
);

s = s.replace(
  '          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}',
  '          {edgePoints.length ? renderEdgePathProjectionLayer() : surfacePolygonClosed ? renderPolygonProjectionLayer() : null}'
);

s = s.replace(
  '          {invertMode && projectionArea && !surfacePolygonClosed && (\n            <div className="projectionSurface" style={toStyle(projectionArea)}>\n              {renderProjectionLayer()}\n            </div>\n          )}',
  '          {invertMode && projectionArea && !surfacePolygonClosed && !edgePoints.length && (\n            <div className="projectionSurface" style={toStyle(projectionArea)}>\n              {renderProjectionLayer()}\n            </div>\n          )}'
);

s = s.replace(
  'Edge-mask conversion is disabled while true scanner-path masks are rebuilt. The edge scanner itself is unchanged.',
  'True scanner-path masks are active when the Edge Scanner is visible. Scanner points inside the projection surface now cut projection paths directly.'
);

writeFileSync(appPath, s);
