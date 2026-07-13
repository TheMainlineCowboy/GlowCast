import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const legend = `              <p className="helperText" aria-label="Mask badge legend">
                Badge key: <strong>A</strong> = auto-detected · <strong>M</strong> = manual correction
              </p>`;

if (source.includes('aria-label="Mask badge legend"')) {
  console.log("Mask origin legend already present.");
} else {
  const headingPattern = /(\s*<h2>Surface \+ Masks(?:[^<]*)<\/h2>)/;
  const match = source.match(headingPattern);

  if (!match) {
    throw new Error("Surface and masks heading anchor not found.");
  }

  source = source.replace(headingPattern, `${match[1]}\n${legend}`);
  await fs.writeFile(path, source);
  console.log("Added visible mask origin legend.");
}
