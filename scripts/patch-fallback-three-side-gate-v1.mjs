import fs from "node:fs";

const p = "src/core/maskCandidateAdapter.ts";
let s = fs.readFileSync(p, "utf8");
let changed = false;

const oldGate = "if (sideCoverage.sides < 2 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;";
const newGate = [
  "// Fallback masks should represent a mostly closed architectural feature, not",
  "// a random L-shaped edge fragment. Three sides preserves doorway/arch recovery",
  "// while rejecting two-sided corner noise.",
  "if (sideCoverage.sides < 3 || !sideCoverage.hasHorizontal || !sideCoverage.hasVertical) continue;"
].join("\n    ");

if (s.includes(oldGate) && !s.includes("Three sides preserves doorway/arch recovery")) {
  s = s.replace(oldGate, newGate);
  changed = true;
}

if (changed) {
  fs.writeFileSync(p, s);
  console.log("fallback three-side gate patch applied");
} else {
  console.log("No changes made. Fallback three-side gate may already be applied.");
}
