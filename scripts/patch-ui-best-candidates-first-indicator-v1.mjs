import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const marker = "Best candidates first";
if (source.includes(marker)) {
  console.log("Best-candidates-first review indicator already present.");
  process.exit(0);
}

const currentStatus = `({includedZones.length} active / {zones.length} total · {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included).length} of {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto enabled · {zones.filter((zone) => !(zone.label ?? "").startsWith("Auto architectural mask")).length} manual)`;
const rankedStatus = `${currentStatus} · Best candidates first`;

if (!source.includes(currentStatus)) {
  throw new Error("Automatic-mask review progress anchor not found for ranking indicator.");
}

source = source.replace(currentStatus, rankedStatus);
await fs.writeFile(path, source);
console.log("Added visible best-candidates-first indicator to automatic-mask review status.");
