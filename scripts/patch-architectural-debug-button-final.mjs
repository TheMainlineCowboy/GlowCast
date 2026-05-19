import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

if (!s.includes("Analyze Structural Candidates")) {
  const marker = "Edge Masks Disabled";
  const markerIndex = s.indexOf(marker);
  if (markerIndex >= 0) {
    const closeIndex = s.indexOf("</button>", markerIndex);
    if (closeIndex >= 0) {
      const insertAt = closeIndex + "</button>".length;
      const controls = `
              <button type="button" onClick={analyzeArchitecturalCandidates} disabled={!showEdges || !edgePoints.length || projectionOnly}>
                Analyze Structural Candidates
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={architecturalDebug} onChange={(event) => setArchitecturalDebug(event.target.checked)} disabled={!architecturalResult} /> Show candidate debug
              </label>
              <p className="helperText">
                {architecturalResult ? "Debug found " + architecturalResult.lines.length + " lines / " + architecturalResult.candidates.length + " boxes." : "Structural debug has not run yet."}
              </p>`;
      s = s.slice(0, insertAt) + controls + s.slice(insertAt);
    }
  }
}

writeFileSync(p, s);
