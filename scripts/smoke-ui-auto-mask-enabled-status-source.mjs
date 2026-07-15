import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'startsWith("Auto architectural mask") && zone.included).length} auto on',
  'startsWith("Auto architectural mask") && !zone.included).length} auto off',
  'startsWith("Auto architectural mask")).length} manual'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Automatic mask status marker missing: ${marker}`);
  }
}

if (source.includes(').length} auto ·')) {
  throw new Error("Automatic mask status must distinguish enabled from disabled detector masks.");
}

console.log("Automatic mask enabled/disabled status source regression passed.");
