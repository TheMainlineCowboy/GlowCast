import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

if (source.includes('aria-label="Mask badge legend"')) {
  console.log("Mask origin legend already present.");
} else {
  const headingStart = source.indexOf("<h2>Surface + Masks");
  const headingEnd = headingStart >= 0 ? source.indexOf("</h2>", headingStart) : -1;
  if (headingEnd < 0) throw new Error("Surface and masks heading anchor not found.");

  const insertAt = headingEnd + 5;
  const legend = '\n              <p className="helperText" aria-label="Mask badge legend">Badge key: <strong>A</strong> = auto-detected / <strong>M</strong> = manual correction</p>';
  source = source.slice(0, insertAt) + legend + source.slice(insertAt);
  await fs.writeFile(path, source);
  console.log("Added visible mask origin legend.");
}
