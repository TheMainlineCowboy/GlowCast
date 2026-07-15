import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const progressStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length} of {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto enabled · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;
const previousReviewState = `${progressStatus}{" "}<strong aria-live="polite">{zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length === 0 ? "· No auto masks yet" : zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length === zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length ? "· Review complete" : \`· \${zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length} auto need review\`}</strong>`;
const clearerReviewState = `${progressStatus}{" "}<strong aria-live="polite">{zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length === 0 ? "· No auto masks yet" : zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length === zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length ? "· ✓ Review complete" : \`· ⚠ \${zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length} auto need review\`}</strong>`;

if (source.includes('"· ✓ Review complete"') && source.includes('`· ⚠ ${')) {
  console.log("Clear automatic mask review state already present.");
} else if (source.includes(previousReviewState)) {
  source = source.replace(previousReviewState, clearerReviewState);
  await fs.writeFile(path, source);
  console.log("Improved automatic mask review completion and warning clarity.");
} else if (source.includes(progressStatus)) {
  source = source.replace(progressStatus, clearerReviewState);
  await fs.writeFile(path, source);
  console.log("Added clear automatic mask review completion and warning state.");
} else {
  throw new Error("Automatic mask review progress anchor not found.");
}
