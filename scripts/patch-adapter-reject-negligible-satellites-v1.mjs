import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const anchor = "  if (satelliteArea >= parentArea * 0.9) return false;";
const gate = "  if (satelliteArea < parentArea * 0.06) return false;";

if (!source.includes(gate)) {
  if (!source.includes(anchor)) {
    throw new Error("satellite area guard anchor not found");
  }
  source = source.replace(anchor, `${anchor}\n${gate}`);
}

await fs.writeFile(path, source);
console.log("negligible satellite rejection ready");
