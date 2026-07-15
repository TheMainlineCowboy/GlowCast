import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldStatus = "({includedZones.length} active / {zones.length} total)";
const newStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;

if (source.includes(newStatus)) {
  console.log("Mask origin counts already present.");
} else if (source.includes(oldStatus)) {
  source = source.replace(oldStatus, newStatus);
  await fs.writeFile(path, source);
  console.log("Added visible auto/manual mask counts.");
} else {
  throw new Error("Live mask count status anchor not found.");
}
