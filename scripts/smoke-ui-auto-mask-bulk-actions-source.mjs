import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "const setAllAutoMasksIncluded = (included: boolean) => {",
  "setZones((currentZones) => currentZones.map((zone) =>",
  "? { ...zone, included } : zone",
  "Enable All Auto Masks",
  "Disable All Auto Masks",
  'aria-label="Enable every automatic mask"',
  'aria-label="Disable every automatic mask"'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Auto-mask bulk action marker missing: ${marker}`);
  }
}

if (!source.includes('disabled={!zones.some((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && !zone.included)}')) {
  throw new Error("Enable-all action must disable itself when every automatic mask is already enabled.");
}

if (!source.includes('disabled={!zones.some((zone) => (zone.label ?? "").startsWith("Auto architectural mask") && zone.included)}')) {
  throw new Error("Disable-all action must disable itself when every automatic mask is already disabled.");
}

const updateBody = source.slice(
  source.indexOf("const setAllAutoMasksIncluded"),
  source.indexOf("const setAllAutoMasksIncluded") + 420
);
if (!updateBody.includes(": zone")) {
  throw new Error("Bulk automatic-mask actions must preserve manual masks unchanged.");
}

console.log("Automatic-mask bulk review actions source regression passed.");
