import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const plainHeading = "Surface + Masks";
const countedHeading = "Surface + Masks ({includedZones.length} active / {zones.length} total)";

if (source.includes(countedHeading)) {
  console.log("live mask count status already present");
} else if (source.includes(plainHeading)) {
  source = source.replace(plainHeading, countedHeading);
  await fs.writeFile(path, source);
  console.log("added live mask count status");
} else {
  throw new Error("Surface + Masks heading not found");
}
