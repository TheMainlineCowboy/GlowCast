import fs from "node:fs/promises";

const appPath = "src/App.tsx";
let source = await fs.readFile(appPath, "utf8");

const statsImport = 'import { getLastMaskCandidateStats } from "./core/maskCandidateAdapter";';
if (!source.includes(statsImport)) {
  const runnerImport = 'import { runCandidateDetection } from "./core/runCandidateDetection";';
  if (!source.includes(runnerImport)) {
    throw new Error("Candidate detection import anchor not found");
  }
  source = source.replace(runnerImport, `${runnerImport}\n${statsImport}`);
}

const oldWarning = `{zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length >= 16 ? <strong className="autoMaskCapWarning" title="GlowCast currently keeps the 16 strongest automatic architectural masks. Check the image for any additional openings that may need a manual mask."> · ⚠ 16-mask detector limit reached</strong> : null}`;
const newWarning = `{getLastMaskCandidateStats().truncated ? <strong className="autoMaskCapWarning" title="GlowCast found additional architectural masks beyond the 16 review slots. Check the image for openings that may need a manual mask."> · ⚠ Additional detector masks need manual review</strong> : null}`;

if (source.includes("Additional detector masks need manual review")) {
  console.log("Accurate automatic-mask truncation warning already present.");
} else if (source.includes(oldWarning)) {
  source = source.replace(oldWarning, newWarning);
  await fs.writeFile(appPath, source);
  console.log("Accurate automatic-mask truncation warning ready.");
} else {
  throw new Error("Existing automatic-mask cap warning anchor not found");
}
