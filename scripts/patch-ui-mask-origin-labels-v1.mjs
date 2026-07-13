import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldMarker = "              <span>{index + 1}</span>";
const newMarker = `              <span
                title={(zone.label ?? "").startsWith("Auto architectural mask") ? "Auto-detected mask" : "Manual mask"}
                aria-label={((zone.label ?? "").startsWith("Auto architectural mask") ? "Auto-detected mask " : "Manual mask ") + (index + 1)}
              >
                {(zone.label ?? "").startsWith("Auto architectural mask") ? "A" : "M"}{index + 1}
              </span>`;

if (source.includes(newMarker)) {
  console.log("Mask origin labels already present.");
} else if (source.includes(oldMarker)) {
  source = source.replace(oldMarker, newMarker);
  await fs.writeFile(path, source);
  console.log("Added visible auto/manual origin labels to mask badges.");
} else {
  throw new Error("Mask number badge anchor not found.");
}
