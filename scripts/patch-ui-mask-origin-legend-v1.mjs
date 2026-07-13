import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const legend = `
              <p className="helperText" aria-label="Mask badge legend">
                Badge key: <strong>A</strong> = auto-detected · <strong>M</strong> = manual correction
              </p>`;

if (source.includes('aria-label="Mask badge legend"')) {
  console.log("Mask origin legend already present.");
} else {
  const headingTextIndex = source.indexOf("Surface + Masks");
  const headingCloseIndex = headingTextIndex >= 0 ? source.indexOf("</h2>", headingTextIndex) : -1;

  if (headingCloseIndex < 0) {
    throw new Error("Surface and masks heading anchor not found.");
  }

  const insertAt = headingCloseIndex + "</h2>".length;
  source = source.slice(0, insertAt) + legend + source.slice(insertAt);
  await fs.writeFile(path, source);
  console.log("Added visible mask origin legend.");
}
