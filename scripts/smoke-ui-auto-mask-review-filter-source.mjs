import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  'const [showOnlyAutoMasks, setShowOnlyAutoMasks] = useState(false);',
  'const visibleSetupZones = showOnlyAutoMasks ? zones.filter',
  'visibleSetupZones.map((zone) => (',
  'Review Auto Masks Only',
  'Show All Masks',
  'aria-pressed={showOnlyAutoMasks}'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Auto-mask review filter marker missing: ${marker}`);
  }
}

if (!source.includes('disabled={!zones.some((zone) => (zone.label ?? "").startsWith("Auto architectural mask"))}')) {
  throw new Error("Auto-mask review filter must be disabled when no automatic masks exist.");
}

if (!source.includes('{zones.findIndex((item) => item.id === zone.id) + 1}')) {
  throw new Error("Filtered mask review must preserve original mask numbering.");
}

console.log("Auto-mask review filter source regression passed.");
