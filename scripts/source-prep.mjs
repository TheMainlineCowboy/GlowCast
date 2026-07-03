import fs from "node:fs/promises";

const file = "src/App.tsx";
let text = await fs.readFile(file, "utf8");

if (!text.includes("source prep marker")) {
  text = text.replace("// --- GEOMETRY ENGINE START ---", "// source prep marker\n// --- GEOMETRY ENGINE START ---");
  await fs.writeFile(file, text);
}

console.log("source prep complete");
