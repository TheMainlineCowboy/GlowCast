import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const countStatus = "({includedZones.length} active / {zones.length} total)";

if (source.includes(countStatus)) {
  console.log("live mask count status already present");
} else {
  const maskHeadingPattern = /<h2>([^<]*Masks[^<]*)<\/h2>/;
  const match = source.match(maskHeadingPattern);

  if (!match) {
    throw new Error("Mask panel heading not found");
  }

  source = source.replace(maskHeadingPattern, `<h2>${match[1].trim()} ${countStatus}</h2>`);
  await fs.writeFile(path, source);
  console.log("added live mask count status");
}
