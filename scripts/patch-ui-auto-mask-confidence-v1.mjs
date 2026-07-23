import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

if (!source.includes("Auto mask confidence:")) {
  const helper = `function getAutoMaskConfidence(zone: ProjectZone | null, surface: Zone | null): "Strong" | "Review" | "Weak" | null {
  if (!zone || !(zone.label ?? "").startsWith("Auto architectural mask")) return null;

  const surfaceArea = Math.max((surface?.width ?? 100) * (surface?.height ?? 100), 1);
  const areaRatio = (zone.width * zone.height) / surfaceArea;
  const aspect = zone.width / Math.max(zone.height, 0.01);
  const vertices = zone.points?.length ?? 4;

  if (areaRatio < 0.008 || aspect < 0.16 || aspect > 6 || vertices > 14) return "Weak";
  if (areaRatio >= 0.02 && areaRatio <= 0.3 && aspect >= 0.25 && aspect <= 4.5 && vertices <= 10) return "Strong";
  return "Review";
}

`;

  const appAnchor = /export default function App\s*\(/;
  const appMatch = source.match(appAnchor);
  if (!appMatch || appMatch.index === undefined) {
    throw new Error("Unable to locate App component for confidence helper insertion.");
  }
  source = source.slice(0, appMatch.index) + helper + source.slice(appMatch.index);

  const statePattern = /(\s+const selectedEditable\s*=\s*selectedTarget\s*===\s*["']surface["']\s*\?\s*projectionArea\s*:\s*selectedZone\s*;)/;
  if (!statePattern.test(source)) {
    throw new Error("Unable to locate selected mask state for confidence categories.");
  }
  source = source.replace(
    statePattern,
    `$1\n  const selectedAutoMaskConfidence = getAutoMaskConfidence(selectedZone, projectionArea);`
  );

  const statusAnchor = " · Best candidates first";
  if (!source.includes(statusAnchor)) {
    throw new Error("Unable to locate automatic-mask review status for confidence categories.");
  }
  source = source.replace(
    statusAnchor,
    ` · Best candidates first{selectedAutoMaskConfidence && <> · Auto mask confidence: {selectedAutoMaskConfidence}</>}`
  );
}

if (!source.includes("data-auto-mask-confidence-overlay")) {
  const zoneNumberAnchor = "              <span>{index + 1}</span>";
  if (!source.includes(zoneNumberAnchor)) {
    throw new Error("Unable to locate zone number badge for confidence overlay.");
  }

  source = source.replace(
    zoneNumberAnchor,
    `${zoneNumberAnchor}\n              {selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence ? (\n                <b\n                  data-auto-mask-confidence-overlay\n                  title={\`GlowCast confidence: \${selectedAutoMaskConfidence}\`}\n                  style={{\n                    position: "absolute",\n                    top: 8,\n                    right: 8,\n                    zIndex: 12,\n                    padding: "4px 8px",\n                    borderRadius: 999,\n                    background: selectedAutoMaskConfidence === "Strong" ? "rgba(20,83,45,.92)" : selectedAutoMaskConfidence === "Weak" ? "rgba(127,29,29,.92)" : "rgba(120,53,15,.92)",\n                    color: "white",\n                    fontSize: 11,\n                    fontWeight: 800,\n                    letterSpacing: ".04em",\n                    boxShadow: "0 2px 10px rgba(0,0,0,.45)",\n                    pointerEvents: "none"\n                  }}\n                >\n                  {selectedAutoMaskConfidence}\n                </b>\n              ) : null}`
  );
}

await fs.writeFile(path, source);
console.log("Added automatic-mask confidence categories and selected-mask overlay badge.");
