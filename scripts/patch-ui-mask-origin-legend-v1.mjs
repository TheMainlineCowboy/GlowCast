import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldMarker = "              <h2>Surface + Masks</h2>";
const newMarker = `              <h2>Surface + Masks</h2>
              <p className="helperText" aria-label="Mask badge legend">
                Badge key: <strong>A</strong> = auto-detected · <strong>M</strong> = manual correction
              </p>`;

if (source.includes(newMarker)) {
  console.log("Mask origin legend already present.");
} else if (source.includes(oldMarker)) {
  source = source.replace(oldMarker, newMarker);
  await fs.writeFile(path, source);
  console.log("Added visible mask origin legend.");
} else {
  throw new Error("Surface and masks heading anchor not found.");
}
