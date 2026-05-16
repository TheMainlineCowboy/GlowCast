import { readFileSync, writeFileSync } from "node:fs";
const path = "src/App.tsx";
const text = readFileSync(path, "utf8");
writeFileSync(path, text);
