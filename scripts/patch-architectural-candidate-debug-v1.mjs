import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

s = s.replace(
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";',
  'import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";\nimport { detectArchitecturalCandidates, type ArchitecturalDetectionResult } from "./core/architecturalDetector";'
);

s = s.replace(
  '  const [snapEnabled, setSnapEnabled] = useState(true);',
  '  const [snapEnabled, setSnapEnabled] = useState(true);\n  const [architecturalDebug, setArchitecturalDebug] = useState(false);\n  const [architecturalResult, setArchitecturalResult] = useState<ArchitecturalDetectionResult | null>(null);'
);

s = s.replace(
  '    setSnapEnabled(true);',
  '    setSnapEnabled(true);\n    setArchitecturalDebug(false);\n    setArchitecturalResult(null);'
);

if (!s.includes("function analyzeArchitecturalCandidates")) {
  s = s.replace('  function resetForPhoto', [
    '  function analyzeArchitecturalCandidates() {',
    '    if (!edgePoints.length) {',
    '      setDetectMessage("Run the Edge Scanner first, then analyze architectural candidates.");',
    '      return;',
    '    }',
    '    const polygon = surfacePolygonClosed && surfacePolygonPoints.length >= 3 ? surfacePolygonPoints : null;',
    '    const bounds = polygon ? {',
    '      x: Math.min(...polygon.map((point) => point.x)),',
    '      y: Math.min(...polygon.map((point) => point.y)),',
    '      width: Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x)),',
    '      height: Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y))',
    '    } : projectionArea;',
    '    const result = detectArchitecturalCandidates(edgePoints, { bounds, polygon });',
    '    setArchitecturalResult(result);',
    '    setArchitecturalDebug(true);',
    '    setDetectMessage(`Architectural debug: ${result.lines.length} structural lines, ${result.candidates.length} candidates. Green = high confidence, yellow = rejected/low confidence.`);',
    '  }',
    '',
    '  function renderArchitecturalDebugOverlay() {',
    '    if (!architecturalDebug || !architecturalResult || projectionOnly) return null;',
    '    return (',
    '      <svg className="architecturalDebugOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 12 }}>',
    '        {architecturalResult.lines.map((line) => (',
    '          <line key={line.id} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#a855f7" strokeWidth="0.28" opacity="0.65" />',
    '        ))}',
    '        {architecturalResult.candidates.map((candidate) => (',
    '          <g key={candidate.id}>',
    '            <rect x={candidate.x} y={candidate.y} width={candidate.width} height={candidate.height} fill={candidate.status === "high" ? "rgba(34,197,94,.13)" : "rgba(250,204,21,.10)"} stroke={candidate.status === "high" ? "#22c55e" : "#facc15"} strokeWidth="0.7" strokeDasharray={candidate.status === "high" ? undefined : "1.2 1"} />',
    '            <text x={candidate.x + 0.6} y={Math.max(2, candidate.y - 0.6)} fill={candidate.status === "high" ? "#22c55e" : "#facc15"} fontSize="2.2" fontWeight="800">{candidate.score}</text>',
    '          </g>',
    '        ))}',
    '      </svg>',
    '    );',
    '  }',
    '',
    '  function resetForPhoto'
  ].join("\n"));
}

s = s.replace(
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n\n          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}',
  '          {surfacePolygonOverlay()}\n          {cornerOverlay()}\n          {renderArchitecturalDebugOverlay()}\n\n          {surfacePolygonClosed ? renderPolygonProjectionLayer() : null}'
);

s = s.replace(
  '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>',
  '              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Magnetic snap\n              </label>\n              <button type="button" onClick={analyzeArchitecturalCandidates} disabled={!showEdges || !edgePoints.length || projectionOnly}>\n                Analyze Structural Candidates\n              </button>\n              <label className="flex items-center gap-2 text-sm text-slate-200">\n                <input type="checkbox" checked={architecturalDebug} onChange={(event) => setArchitecturalDebug(event.target.checked)} disabled={!architecturalResult} /> Show candidate debug\n              </label>'
);

writeFileSync(p, s);
