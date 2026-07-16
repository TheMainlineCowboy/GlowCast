import fs from "node:fs/promises";

const appPath = "src/App.tsx";
let source = await fs.readFile(appPath, "utf8");

const oldWarning = `{getLastMaskCandidateStats().truncated ? <strong className="autoMaskCapWarning" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} lower-ranked result(s). Check the image for openings that may need a manual mask.\`}> · ⚠ {getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} additional mask(s) need manual review</strong> : null}`;
const newWarning = `{getLastMaskCandidateStats().truncated ? (() => { const omittedMaskCount = getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned; const omittedMaskLabel = omittedMaskCount === 1 ? "mask" : "masks"; const resultLabel = omittedMaskCount === 1 ? "result" : "results"; return <strong className="autoMaskCapWarning" title={\`GlowCast kept the \${getLastMaskCandidateStats().returned} strongest automatic masks and omitted \${omittedMaskCount} lower-ranked \${resultLabel}. Check the image for openings that may need a manual mask.\`}> · ⚠ {omittedMaskCount} additional {omittedMaskLabel} need manual review</strong>; })() : null}`;

if (source.includes("const omittedMaskLabel = omittedMaskCount === 1")) {
  console.log("Clear omitted automatic-mask wording already present.");
} else if (source.includes(oldWarning)) {
  source = source.replace(oldWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Clear omitted automatic-mask wording ready.");
} else {
  throw new Error("Omitted automatic-mask count warning anchor not found");
}
