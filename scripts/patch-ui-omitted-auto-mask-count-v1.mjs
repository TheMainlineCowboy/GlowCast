import fs from "node:fs/promises";

const appPath = "src/App.tsx";
let source = await fs.readFile(appPath, "utf8");

const oldWarning = `{getLastMaskCandidateStats().truncated ? <strong className="autoMaskCapWarning" title="GlowCast found additional architectural masks beyond the 16 review slots. Check the image for openings that may need a manual mask."> · ⚠ Additional detector masks need manual review</strong> : null}`;
const newWarning = `{getLastMaskCandidateStats().truncated ? <strong className="autoMaskCapWarning" title={\`GlowCast kept the ${getLastMaskCandidateStats().returned} strongest automatic masks and omitted ${getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} lower-ranked result(s). Check the image for openings that may need a manual mask.\`}> · ⚠ {getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned} additional mask(s) need manual review</strong> : null}`;

if (source.includes("additional mask(s) need manual review")) {
  console.log("Omitted automatic-mask count already present.");
} else if (source.includes(oldWarning)) {
  source = source.replace(oldWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Omitted automatic-mask count ready.");
} else {
  throw new Error("Accurate automatic-mask truncation warning anchor not found");
}
