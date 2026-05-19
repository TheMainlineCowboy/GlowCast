import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

if (!app.includes("archDebugBadge")) {
  const badge = `
          {architecturalDebug && architecturalResult && !projectionOnly ? (
            <div className="archDebugBadge">
              Debug: {architecturalResult.lines.length} lines / {architecturalResult.candidates.length} boxes
            </div>
          ) : null}`;
  const marker = "          {surfacePolygonOverlay()}";
  const idx = app.indexOf(marker);
  if (idx >= 0) app = app.slice(0, idx) + badge + "\n" + app.slice(idx);
}

writeFileSync(appPath, app);

const cssPath = "src/App.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes(".archDebugBadge")) {
  css += `
.archDebugBadge {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 60;
  background: rgba(2, 6, 23, 0.92);
  color: #e0f2fe;
  border: 1px solid #22d3ee;
  border-radius: 10px;
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 900;
  pointer-events: none;
}
`;
}
writeFileSync(cssPath, css);
