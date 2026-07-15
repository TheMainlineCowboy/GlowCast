import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'startsWith("Auto architectural mask") && zone.included).length} of {zones.filter((zone) => (zone.label ?? "").startsWith("Auto architectural mask")).length} auto enabled',
  'startsWith("Auto architectural mask")).length} manual'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Automatic mask review progress marker missing: ${marker}`);
  }
}

if (source.includes(').length} auto on ·') || source.includes(').length} auto off ·')) {
  throw new Error("Automatic mask summary should use enabled-of-total review progress.");
}

console.log("Automatic mask review progress source regression passed.");
