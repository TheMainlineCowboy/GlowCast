import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const headingPattern = /<h2>Surface \+ Masks(?: \(\{includedZones\.length\} active \/ \{zones\.length\} total\))?<\/h2>/;
const newHeading = "<h2>Surface + Masks ({includedZones.length} active / {zones.length} total)</h2>";

if (!headingPattern.test(source)) {
  throw new Error("Surface + Masks heading not found");
}

source = source.replace(headingPattern, newHeading);
await fs.writeFile(path, source);
console.log("added live mask count status");
