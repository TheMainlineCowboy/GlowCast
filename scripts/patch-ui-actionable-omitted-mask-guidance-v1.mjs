import fs from "node:fs/promises";

const appPath = "src/App.tsx";
let source = await fs.readFile(appPath, "utf8");

const oldWarning = `return <strong className="autoMaskCapWarning" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${omittedMaskCount} lower-ranked \${resultLabel}. Check the image for openings that may need a manual mask.\`}> · ⚠ {omittedMaskCount} additional {omittedMaskLabel} need manual review</strong>;`;
const newWarning = `return <strong className="autoMaskCapWarning" role="status" aria-live="polite" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${omittedMaskCount} lower-ranked \${resultLabel}. Check the image for openings that may need a manual mask.\`}> · ⚠ {omittedMaskCount} additional {omittedMaskLabel} need manual review — check image for missed openings</strong>;`;

if (source.includes("need manual review — check image for missed openings")) {
  console.log("Actionable omitted-mask guidance already present.");
} else if (source.includes(oldWarning)) {
  source = source.replace(oldWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Actionable omitted-mask guidance ready.");
} else {
  throw new Error("Clear omitted-mask warning anchor not found");
}
