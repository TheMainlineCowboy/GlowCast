import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const handlesMarker = '              {renderHandles("zone", zone)}';
const warningBadge = `              {overlappingAutoMaskIds.has(zone.id) || selectedRetainedOverlapId === zone.id ? (\n                <strong\n                  aria-label={overlappingAutoMaskIds.has(zone.id)\n                    ? selectedZoneId === zone.id\n                      ? "Selected automatic mask is scheduled for overlap removal"\n                      : "This automatic mask substantially overlaps another mask and is marked for cleanup"\n                    : "This automatic mask is the paired stronger overlap candidate and will be kept"}\n                  title={overlappingAutoMaskIds.has(zone.id)\n                    ? selectedZoneId === zone.id\n                      ? "Remove candidate — this mask will be discarded if cleanup runs"\n                      : "Overlap candidate — select Review Overlaps to inspect"\n                    : "Paired keep candidate — this stronger mask remains when the selected overlap is removed"}\n                  style={{\n                    position: "absolute",\n                    right: 4,\n                    top: 4,\n                    zIndex: 3,\n                    border: "2px solid #fef3c7",\n                    borderRadius: 999,\n                    padding: "3px 8px",\n                    background: overlappingAutoMaskIds.has(zone.id)\n                      ? selectedZoneId === zone.id\n                        ? "rgba(220, 38, 38, 0.98)"\n                        : "rgba(245, 158, 11, 0.98)"\n                      : "rgba(22, 163, 74, 0.98)",\n                    boxShadow: overlappingAutoMaskIds.has(zone.id)\n                      ? selectedZoneId === zone.id\n                        ? "0 0 0 2px rgba(17, 24, 39, 0.8), 0 0 16px rgba(220, 38, 38, 0.95)"\n                        : "0 0 0 2px rgba(17, 24, 39, 0.75), 0 0 14px rgba(245, 158, 11, 0.9)"\n                      : "0 0 0 2px rgba(17, 24, 39, 0.75), 0 0 14px rgba(22, 163, 74, 0.9)",\n                    color: overlappingAutoMaskIds.has(zone.id) && selectedZoneId !== zone.id ? "#111827" : "#ffffff",\n                    fontSize: 10,\n                    fontWeight: 800,\n                    letterSpacing: "0.04em",\n                    pointerEvents: "none"\n                  }}\n                >\n                  {overlappingAutoMaskIds.has(zone.id)\n                    ? selectedZoneId === zone.id ? "REMOVE" : "OVERLAP"\n                    : "KEEP"}\n                </strong>\n              ) : null}\n\n`;

if (!source.includes("Paired keep candidate — this stronger mask remains")) {
  const existingStartCandidates = [
    '              {overlappingAutoMaskIds.has(zone.id) || retainedOverlappingAutoMaskIds.has(zone.id) ? (',
    '              {overlappingAutoMaskIds.has(zone.id) ? ('
  ];
  const existingStart = existingStartCandidates
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0) ?? -1;
  if (existingStart >= 0) {
    const existingEndMarker = "              ) : null}\n\n";
    const existingEnd = source.indexOf(existingEndMarker, existingStart);
    if (existingEnd < 0) throw new Error("Existing overlap badge end not found.");
    source = source.slice(0, existingStart) + warningBadge + source.slice(existingEnd + existingEndMarker.length);
  } else {
    const handlesIndex = source.indexOf(handlesMarker);
    if (handlesIndex < 0) throw new Error("Zone handle anchor not found for overlap badge.");
    source = source.slice(0, handlesIndex) + warningBadge + source.slice(handlesIndex);
  }
}

await fs.writeFile(path, source);
await import("./patch-ui-overlap-review-decision-guidance-v1.mjs");
await import("./smoke-ui-overlap-review-decision-guidance-source.mjs");
console.log("Applied pair-specific overlap keep/remove comparison badges and review guidance.");
