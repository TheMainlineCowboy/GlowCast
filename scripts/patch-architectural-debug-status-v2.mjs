import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

if (!s.includes('Architectural Debug:')) {
  s = s.replace(
    '      <svg className="architecturalDebugOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 12 }}>',
    '      <svg className="architecturalDebugOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 12 }}>\n        <rect x="1" y="1" width="44" height="7" rx="1.2" fill="rgba(2,6,23,.86)" stroke="#22d3ee" strokeWidth=".25" />\n        <text x="2.2" y="5.8" fill="#e0f2fe" fontSize="2.4" fontWeight="900">Architectural Debug: {architecturalResult.lines.length} lines / {architecturalResult.candidates.length} boxes</text>'
  );
}

writeFileSync(p, s);
