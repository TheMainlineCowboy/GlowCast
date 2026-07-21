import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "Reviewing overlap candidate",
  "Red REMOVE will be discarded; green KEEP will remain."
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing overlap review guidance marker: ${marker}`);
  }
}

console.log("Overlap review decision guidance source smoke passed.");
