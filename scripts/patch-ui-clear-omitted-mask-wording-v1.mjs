import fs from "node:fs/promises";

const appPath = "src/App.tsx";
let source = await fs.readFile(appPath, "utf8");

const oldWarning = `{getLastMaskCandidateStats().truncated ? <strong className="autoMaskCapWarning" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} lower-ranked result(s). Check the image for openings that may need a manual mask.\`}> · ⚠ {getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} additional mask(s) need manual review</strong> : null}`;
const priorWarning = `{getLastMaskCandidateStats().truncated ? (() => { const omittedMaskCount = getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned; const omittedMaskLabel = omittedMaskCount === 1 ? "mask" : "masks"; const resultLabel = omittedMaskCount === 1 ? "result" : "results"; return <strong className="autoMaskCapWarning" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${omittedMaskCount} lower-ranked \${resultLabel}. Check the image for openings that may need a manual mask.\`}> · ⚠ {omittedMaskCount} additional {omittedMaskLabel} need manual review</strong>; })() : null}`;
const newWarning = `{getLastMaskCandidateStats().truncated ? (() => { const omittedMaskCount = getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned; const omittedMaskLabel = omittedMaskCount === 1 ? "mask" : "masks"; const resultLabel = omittedMaskCount === 1 ? "result" : "results"; return <strong className="autoMaskCapWarning" role="status" aria-live="polite" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${omittedMaskCount} lower-ranked \${resultLabel}. Check the image for openings that may need a manual mask.\`}> · ⚠ {omittedMaskCount} additional {omittedMaskLabel} need manual review — check image for missed openings</strong>; })() : null}`;

if (source.includes("need manual review — check image for missed openings")) {
  console.log("Actionable omitted automatic-mask wording already present.");
} else if (source.includes(priorWarning)) {
  source = source.replace(priorWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Actionable omitted automatic-mask wording ready.");
} else if (source.includes(oldWarning)) {
  source = source.replace(oldWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Actionable omitted automatic-mask wording ready.");
} else {
  throw new Error("Omitted automatic-mask count warning anchor not found");
}
