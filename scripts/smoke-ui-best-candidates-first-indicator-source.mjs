import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "Best candidates first",
  "auto enabled",
  "manual)"
];
const missing = required.filter((fragment) => !source.includes(fragment));
if (missing.length) {
  throw new Error(`Best-candidates-first indicator smoke failed; missing: ${missing.join(", ")}`);
}
console.log("best-candidates-first review indicator source smoke passed");
