import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const previousStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length} auto on · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length} auto off · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;
const progressStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length} of {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto enabled · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;

if (source.includes(progressStatus)) {
  console.log("Automatic mask review progress already present.");
} else if (source.includes(previousStatus)) {
  source = source.replace(previousStatus, progressStatus);
  await fs.writeFile(path, source);
  console.log("Added compact automatic mask review progress.");
} else {
  throw new Error("Automatic mask enabled/disabled status anchor not found.");
}
