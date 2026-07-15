import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const originalClass = 'className={`zone ${shapeClass(zone.shape)} ${zone.included ? "included" : "excluded"} ${selectedTarget === "zone" && selectedZoneId === zone.id ? "selected" : ""}`}';
const focusedClass = 'className={`zone ${shapeClass(zone.shape)} ${zone.included ? "included" : "excluded"} ${selectedTarget === "zone" && selectedZoneId === zone.id ? "selected" : ""} ${selectedTarget === "zone" && selectedZoneId === zone.id && (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included ? "autoReviewFocus" : ""}`}';

if (!source.includes("autoReviewFocus")) {
  if (!source.includes(originalClass)) throw new Error("Zone class anchor not found.");
  source = source.replace(originalClass, focusedClass);
}

const styleMarker = "</main>\n    );\n  }\n\n  const stage = (";
const focusStyles = `      <style>{\`\n        @keyframes autoReviewPulse {\n          0%, 100% { box-shadow: 0 0 0 3px rgba(250, 204, 21, .95), 0 0 0 9px rgba(250, 204, 21, .18); }\n          50% { box-shadow: 0 0 0 5px rgba(250, 204, 21, 1), 0 0 0 15px rgba(250, 204, 21, .08); }\n        }\n        .zone.autoReviewFocus {\n          z-index: 12;\n          animation: autoReviewPulse 1.15s ease-in-out infinite;\n        }\n        @media (prefers-reduced-motion: reduce) {\n          .zone.autoReviewFocus { animation: none; box-shadow: 0 0 0 4px rgba(250, 204, 21, 1), 0 0 0 10px rgba(250, 204, 21, .16); }\n        }\n      \`}</style>\n`;

if (!source.includes("@keyframes autoReviewPulse")) {
  const markerIndex = source.indexOf(styleMarker);
  if (markerIndex < 0) throw new Error("Stage style insertion anchor not found.");
  const stageIndex = source.indexOf("  const stage = (", markerIndex);
  source = source.slice(0, stageIndex) + focusStyles + source.slice(stageIndex);
}

await fs.writeFile(path, source);
console.log("Applied automatic-mask review focus treatment.");
