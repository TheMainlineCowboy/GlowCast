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

if (!source.includes("function isNearbyMaskCandidate(")) {
  const helper = `function isNearbyMaskCandidate(candidate: ProjectZone, selected: ProjectZone | null, surface: Zone | null): boolean {
  if (!selected || candidate.id === selected.id) return false;

  const surfaceWidth = Math.max(surface?.width ?? 100, 1);
  const surfaceHeight = Math.max(surface?.height ?? 100, 1);
  const candidateCenterX = candidate.x + candidate.width / 2;
  const candidateCenterY = candidate.y + candidate.height / 2;
  const selectedCenterX = selected.x + selected.width / 2;
  const selectedCenterY = selected.y + selected.height / 2;
  const normalizedDistance = Math.hypot(
    (candidateCenterX - selectedCenterX) / surfaceWidth,
    (candidateCenterY - selectedCenterY) / surfaceHeight
  );

  return normalizedDistance <= 0.34;
}

`;
  const appAnchor = /export default function App\s*\(/;
  const appMatch = source.match(appAnchor);
  if (!appMatch || appMatch.index === undefined) {
    throw new Error("Unable to locate App component for nearby-candidate helper insertion.");
  }
  source = source.slice(0, appMatch.index) + helper + source.slice(appMatch.index);
}

if (!source.includes("data-auto-mask-confidence-overlay")) {
  const shapeAnchor = /(?<indent>^[ \t]*)\{zone\.shape\s*===\s*["']triangle["']\s*\?\s*\(/m;
  const shapeMatch = source.match(shapeAnchor);
  if (!shapeMatch || !shapeMatch.groups) {
    throw new Error("Unable to locate mask shape rendering block for confidence overlay.");
  }

  const indent = shapeMatch.groups.indent;
  const overlay = `${indent}{selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence ? (\n${indent}  <b\n${indent}    data-auto-mask-confidence-overlay\n${indent}    data-auto-mask-review-state={zone.included ? "accepted" : "pending"}\n${indent}    title={\`GlowCast confidence: \${selectedAutoMaskConfidence}. Review state: \${zone.included ? "Accepted" : "Pending review"}.\`}\n${indent}    style={{\n${indent}      position: "absolute",\n${indent}      top: 8,\n${indent}      right: 8,\n${indent}      zIndex: 12,\n${indent}      display: "inline-flex",\n${indent}      alignItems: "center",\n${indent}      gap: 6,\n${indent}      padding: "4px 8px",\n${indent}      borderRadius: 999,\n${indent}      background: zone.included ? "rgba(20,83,45,.94)" : "rgba(120,53,15,.94)",\n${indent}      color: "white",\n${indent}      fontSize: 11,\n${indent}      fontWeight: 800,\n${indent}      letterSpacing: ".04em",\n${indent}      boxShadow: "0 2px 10px rgba(0,0,0,.45)",\n${indent}      pointerEvents: "none"\n${indent}    }}\n${indent}  >\n${indent}    <span>{zone.included ? "Accepted" : "Pending review"}</span>\n${indent}    <span aria-hidden="true">·</span>\n${indent}    <span>{selectedAutoMaskConfidence}</span>\n${indent}  </b>\n${indent}) : null}\n\n${shapeMatch[0]}`;

  source = source.replace(shapeAnchor, overlay);
} else if (!source.includes("data-auto-mask-review-state")) {
  source = source.replace(
    "data-auto-mask-confidence-overlay\n",
    'data-auto-mask-confidence-overlay\n                    data-auto-mask-review-state={zone.included ? "accepted" : "pending"}\n'
  );
  source = source.replace(
    'title={`GlowCast confidence: ${selectedAutoMaskConfidence}`}',
    'title={`GlowCast confidence: ${selectedAutoMaskConfidence}. Review state: ${zone.included ? "Accepted" : "Pending review"}.`}'
  );
  source = source.replace(
    'background: selectedAutoMaskConfidence === "Strong" ? "rgba(20,83,45,.92)" : selectedAutoMaskConfidence === "Weak" ? "rgba(127,29,29,.92)" : "rgba(120,53,15,.92)",',
    'background: zone.included ? "rgba(20,83,45,.94)" : "rgba(120,53,15,.94)",'
  );
  source = source.replace(
    '{selectedAutoMaskConfidence}\n',
    '<span>{zone.included ? "Accepted" : "Pending review"}</span>\n                    <span aria-hidden="true">·</span>\n                    <span>{selectedAutoMaskConfidence}</span>\n'
  );
}

if (!source.includes("data-nearby-strong-auto-mask")) {
  const shapeAnchor = /(?<indent>^[ \t]*)\{zone\.shape\s*===\s*["']triangle["']\s*\?\s*\(/m;
  const shapeMatch = source.match(shapeAnchor);
  if (!shapeMatch || !shapeMatch.groups) {
    throw new Error("Unable to locate mask shape rendering block for nearby strong candidates.");
  }

  const indent = shapeMatch.groups.indent;
  const overlay = `${indent}{selectedAutoMaskConfidence && selectedAutoMaskConfidence !== "Strong" && getAutoMaskConfidence(zone, projectionArea) === "Strong" && isNearbyMaskCandidate(zone, selectedZone, projectionArea) ? (\n${indent}  <b\n${indent}    data-nearby-strong-auto-mask\n${indent}    title="Nearby strong automatic-mask candidate"\n${indent}    style={{\n${indent}      position: "absolute",\n${indent}      left: 6,\n${indent}      bottom: 6,\n${indent}      zIndex: 11,\n${indent}      padding: "3px 7px",\n${indent}      borderRadius: 999,\n${indent}      border: "1px solid rgba(134,239,172,.9)",\n${indent}      background: "rgba(20,83,45,.82)",\n${indent}      color: "white",\n${indent}      fontSize: 10,\n${indent}      fontWeight: 800,\n${indent}      letterSpacing: ".04em",\n${indent}      boxShadow: "0 0 0 2px rgba(34,197,94,.22), 0 2px 8px rgba(0,0,0,.35)",\n${indent}      pointerEvents: "none"\n${indent}    }}\n${indent}  >\n${indent}    Strong alternative\n${indent}  </b>\n${indent}) : null}\n\n${shapeMatch[0]}`;
  source = source.replace(shapeAnchor, overlay);
}

await fs.writeFile(path, source);
console.log("Added automatic-mask confidence, review state, and nearby strong-candidate comparison overlays.");
