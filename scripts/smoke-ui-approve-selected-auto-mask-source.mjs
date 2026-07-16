import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredFragments = [
  "const approveSelectedAutoMask = () => {",
  "const disabledAutoMasks = zones.filter",
  "const selectedIndex = disabledAutoMasks.findIndex",
  "const remainingAutoMasks = disabledAutoMasks.filter",
  "Math.min(selectedIndex, remainingAutoMasks.length - 1)",
  "zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone",
  "setSelectedZoneId(nextAutoMask?.id ?? null)",
  "onClick={approveSelectedAutoMask}",
  "Enable & Review Next Auto Mask (",
  "zones.filter((zone) =>",
  "!zone.included).length",
  "remaining)",
  'aria-label="Enable the selected automatic mask and review the next disabled automatic mask"'
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing reviewed auto-mask approve-and-advance wiring: ${fragment}`);
  }
}

if (source.includes("setAllAutoMasksIncluded(true)")) {
  throw new Error("Reviewed-mask approval must not enable every automatic mask.");
}

if (source.includes("Enable Reviewed Auto Mask")) {
  throw new Error("The previous non-advancing reviewed-mask label must not remain.");
}

console.log("Selected automatic-mask approve-and-advance remaining-count source smoke passed.");