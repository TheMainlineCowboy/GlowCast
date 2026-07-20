import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const originalClass = 'className={`zone ${shapeClass(zone.shape)} ${zone.included ? "included" : "excluded"} ${selectedTarget === "zone" && selectedZoneId === zone.id ? "selected" : ""}`}';
const warningClass = 'className={`zone ${shapeClass(zone.shape)} ${zone.included ? "included" : "excluded"} ${overlappingAutoMaskIds.has(zone.id) ? "overlapCandidate" : ""} ${selectedTarget === "zone" && selectedZoneId === zone.id ? "selected" : ""}`}';

if (!source.includes('overlappingAutoMaskIds.has(zone.id) ? "overlapCandidate"')) {
  if (!source.includes(originalClass)) throw new Error("Zone class anchor not found for overlap warning.");
  source = source.replace(originalClass, warningClass);
}

const originalStyle = 'style={{ ...toStyle(zone), ...(zone.points ? { clipPath: `polygon(${zone.points.map((p) => `${p.x}% ${p.y}%`).join(",")})` } : {}) }}';
const warningStyle = 'style={{ ...toStyle(zone), ...(overlappingAutoMaskIds.has(zone.id) ? { boxShadow: "0 0 0 3px #f59e0b, 0 0 18px rgba(245, 158, 11, 0.8)", outline: "2px dashed #fef3c7", outlineOffset: 3 } : {}), ...(zone.points ? { clipPath: `polygon(${zone.points.map((p) => `${p.x}% ${p.y}%`).join(",")})` } : {}) }}';

if (!source.includes('boxShadow: "0 0 0 3px #f59e0b')) {
  const zoneRenderStart = source.indexOf('className={`zone ${shapeClass(zone.shape)}');
  if (zoneRenderStart < 0) throw new Error("Zone render anchor not found for overlap outline.");
  const styleIndex = source.indexOf(originalStyle, zoneRenderStart);
  if (styleIndex < 0) throw new Error("Zone style anchor not found for overlap outline.");
  source = source.slice(0, styleIndex) + warningStyle + source.slice(styleIndex + originalStyle.length);
}

const numberMarker = "              <span>{index + 1}</span>";
const warningBadge = `              <span>{index + 1}</span>\n              {overlappingAutoMaskIds.has(zone.id) ? (\n                <strong\n                  aria-label="This automatic mask substantially overlaps another mask and is marked for cleanup"\n                  title="Overlap candidate — review before removal"\n                  style={{\n                    position: "absolute",\n                    right: 4,\n                    top: 4,\n                    zIndex: 3,\n                    borderRadius: 999,\n                    padding: "2px 7px",\n                    background: "rgba(245, 158, 11, 0.95)",\n                    color: "#111827",\n                    fontSize: 10,\n                    fontWeight: 800,\n                    letterSpacing: "0.04em",\n                    pointerEvents: "none"\n                  }}\n                >\n                  OVERLAP\n                </strong>\n              ) : null}`;

if (!source.includes("Overlap candidate — review before removal")) {
  if (!source.includes(numberMarker)) throw new Error("Zone number anchor not found for overlap badge.");
  source = source.replace(numberMarker, warningBadge);
}

await fs.writeFile(path, source);
console.log("Applied overlap candidate warning outline and badge.");
