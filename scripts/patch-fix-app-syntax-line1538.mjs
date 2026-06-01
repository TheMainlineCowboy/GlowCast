import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

app = app.replaceAll(
  '<polygon points={zone.points.map((point) => point.x + "," + point.y).join(" ")} />',
  '<polygon points={zone.points.map((point) => point.x + "," + point.y).join(" ")} />'
);

// Repair the common malformed JSX produced when the freehand outline path was replaced
// inside an already-embedded JSX block.
app = app.replace(
  /\{zone\.shape === "freehand" \? \([\s\S]*?<svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">[\s\S]*?<\/svg>\s*\) : null\}/,
  `{zone.shape === "freehand" ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {zone.points && zone.points.length >= 3 ? (
                    <polygon points={zone.points.map((point) => point.x + "," + point.y).join(" ")} />
                  ) : (
                    <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />
                  )}
                </svg>
              ) : null}`
);

writeFileSync(path, app);
console.log("fixed malformed freehand edge candidate JSX");
