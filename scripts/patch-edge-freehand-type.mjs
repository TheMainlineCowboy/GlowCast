import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let app = readFileSync(path, "utf8");

app = app.replaceAll('shape: "freehand",', 'shape: "freehand" as MaskShape,');

const helperOld = 'const shapeClass = (shape?: MaskShape) => `shape-${shape ?? "rectangle"}`;';
const helperNew = 'const shapeClass = (shape?: MaskShape) => `shape-${shape ?? "rectangle"}`;\nconst zoneShapeClass = (zone: Pick<ProjectZone, "shape" | "points">) => `shape-${zone.points?.length ? "polygon" : zone.shape ?? "rectangle"}`;\nconst zoneClipStyle = (zone: Pick<ProjectZone, "points">) => zone.points?.length ? { clipPath: `polygon(${zone.points.map((point) => `${point.x}% ${point.y}%`).join(",")})` } : {};\nconst zonePolygonSvgPoints = (zone: Pick<ProjectZone, "points">) => zone.points?.map((point) => `${point.x},${point.y}`).join(" ") ?? "";';
if (!app.includes('const zoneShapeClass =')) {
  if (!app.includes(helperOld)) throw new Error("Could not find shapeClass helper.");
  app = app.replace(helperOld, helperNew);
}

app = app.replaceAll('shapeClass(zone.shape)', 'zoneShapeClass(zone)');
app = app.replaceAll('...(zone.points ? { clipPath: `polygon(${zone.points.map((p) => `${p.x}% ${p.y}%`).join(",")})` } : {})', '...zoneClipStyle(zone)');

const oldBlock = `              {zone.shape === "triangle" ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points="50,0 100,100 0,100" />
                </svg>
              ) : null}

              {(zone.shape === "circle" || zone.shape === "oval") ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <ellipse cx="50" cy="50" rx="49" ry="49" />
                </svg>
              ) : null}

              {zone.shape === "freehand" ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />
                </svg>
              ) : null}`;
const newBlock = `              {zone.points?.length ? (
                <svg className="zoneShapeOutline polygonMaskOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points={zonePolygonSvgPoints(zone)} />
                </svg>
              ) : zone.shape === "triangle" ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points="50,0 100,100 0,100" />
                </svg>
              ) : null}

              {!zone.points?.length && (zone.shape === "circle" || zone.shape === "oval") ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <ellipse cx="50" cy="50" rx="49" ry="49" />
                </svg>
              ) : null}

              {!zone.points?.length && zone.shape === "freehand" ? (
                <svg className="zoneShapeOutline" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M8,42 C14,12 35,4 50,8 C75,2 94,24 92,50 C96,76 70,96 46,90 C20,98 4,70 8,42 Z" />
                </svg>
              ) : null}`;
if (app.includes(oldBlock)) app = app.replace(oldBlock, newBlock);

writeFileSync(path, app);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
const cssPatch = '.shape-polygon{border-radius:0!important}.zone.shape-polygon{background:rgba(253,224,71,.10);border:0;outline:none;box-shadow:none}.maskCutout.shape-polygon,.projectorMaskCutout.shape-polygon,.zoneProjection.shape-polygon{border-radius:0!important}.polygonMaskOutline{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.polygonMaskOutline polygon{fill:rgba(253,224,71,.16);stroke:#fef08a;stroke-width:4;vector-effect:non-scaling-stroke}.zone.shape-polygon.selected .polygonMaskOutline polygon{stroke:#67e8f9;filter:drop-shadow(0 0 8px rgba(103,232,249,.85))}';
if (!css.includes('.shape-polygon')) css += cssPatch;
writeFileSync(cssPath, css);

console.log("typed freehand edge masks and rendered stored polygon outlines");
