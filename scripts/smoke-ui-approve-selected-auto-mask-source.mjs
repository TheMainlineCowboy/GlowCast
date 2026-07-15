import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredFragments = [
  "const approveSelectedAutoMask = () => {",
  "zone.id === selectedZoneId",
  '(zone.label ?? "").startsWith("Auto architectural mask")',
  "!zone.included",
  "zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone",
  "onClick={approveSelectedAutoMask}",
  "Enable Reviewed Auto Mask",
  'aria-label="Enable the selected automatic mask after review"'
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing reviewed auto-mask approval wiring: ${fragment}`);
  }
}

if (source.includes("setAllAutoMasksIncluded(true)} aria-label=\"Enable the selected automatic mask after review\"")) {
  throw new Error("Reviewed-mask approval must not enable every automatic mask.");
}

console.log("Selected automatic-mask approval source smoke passed.");
