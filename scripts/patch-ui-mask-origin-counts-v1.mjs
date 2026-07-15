import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldStatus = "({includedZones.length} active / {zones.length} total)";
const previousStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;
const newStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length} auto on · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length} auto off · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;

if (source.includes(newStatus)) {
  console.log("Automatic mask enabled/disabled counts already present.");
} else if (source.includes(previousStatus)) {
  source = source.replace(previousStatus, newStatus);
  await fs.writeFile(path, source);
  console.log("Expanded automatic mask status with enabled and disabled counts.");
} else if (source.includes(oldStatus)) {
  source = source.replace(oldStatus, newStatus);
  await fs.writeFile(path, source);
  console.log("Added visible automatic mask enabled/disabled counts.");
} else {
  throw new Error("Live mask count status anchor not found.");
}
