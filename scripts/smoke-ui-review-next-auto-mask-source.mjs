import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  "const reviewNextDisabledAutoMask = () => {",
  "const disabledAutoMasks = zones.filter((zone) =>",
  "findIndex((zone) => zone.id === selectedZoneId)",
  "(currentIndex + 1) % disabledAutoMasks.length",
  "setSelectedTarget(\"zone\")",
  "setSelectedZoneId(nextMask.id)",
  "Review Next Auto Mask (",
  "remaining)",
  'aria-label="Select the next disabled automatic mask for review"'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Next automatic-mask review marker missing: ${marker}`);
  }
}

if (!source.includes('disabled={!zones.some((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included)}')) {
  throw new Error("Review-next action must disable itself when no disabled automatic masks remain.");
}

if (!source.includes('zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included).length')) {
  throw new Error("Review-next action must show the live remaining automatic-mask count.");
}

if (!source.includes('startsWith("Auto architectural mask") && !zone.included')) {
  throw new Error("Review-next action must only cycle through disabled automatic masks.");
}

console.log("Counted next automatic-mask review source regression passed.");
