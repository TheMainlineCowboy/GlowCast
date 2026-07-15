import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const reviewState = `<strong aria-live="polite">{zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length === 0 ? "· No auto masks yet" : zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length === zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length ? "· ✓ Review complete" : \`· ⚠ \${zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length} auto need review\`}</strong>`;
const capWarning = `${reviewState}{zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length >= 16 ? <strong className="autoMaskCapWarning" title="GlowCast currently keeps the 16 strongest automatic architectural masks. Check the image for any additional openings that may need a manual mask."> · ⚠ 16-mask detector limit reached</strong> : null}`;

if (source.includes("16-mask detector limit reached")) {
  console.log("Automatic mask result-cap warning already present.");
} else if (source.includes(reviewState)) {
  source = source.replace(reviewState, capWarning);
  await fs.writeFile(path, source);
  console.log("Added automatic mask result-cap warning.");
} else {
  throw new Error("Automatic mask review-state anchor not found.");
}
