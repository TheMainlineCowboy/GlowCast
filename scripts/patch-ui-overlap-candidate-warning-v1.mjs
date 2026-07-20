import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const numberMarker = "              <span>{index + 1}</span>";
const warningBadge = `              <span>{index + 1}</span>\n              {overlappingAutoMaskIds.has(zone.id) ? (\n                <strong\n                  aria-label="This automatic mask substantially overlaps another mask and is marked for cleanup"\n                  title="Overlap candidate — review before removal"\n                  style={{\n                    position: "absolute",\n                    right: 4,\n                    top: 4,\n                    zIndex: 3,\n                    border: "2px solid #fef3c7",\n                    borderRadius: 999,\n                    padding: "3px 8px",\n                    background: "rgba(245, 158, 11, 0.98)",\n                    boxShadow: "0 0 0 2px rgba(17, 24, 39, 0.75), 0 0 14px rgba(245, 158, 11, 0.9)",\n                    color: "#111827",\n                    fontSize: 10,\n                    fontWeight: 800,\n                    letterSpacing: "0.04em",\n                    pointerEvents: "none"\n                  }}\n                >\n                  OVERLAP\n                </strong>\n              ) : null}`;

if (!source.includes("Overlap candidate — review before removal")) {
  if (!source.includes(numberMarker)) throw new Error("Zone number anchor not found for overlap badge.");
  source = source.replace(numberMarker, warningBadge);
}

await fs.writeFile(path, source);
console.log("Applied overlap candidate warning badge.");
