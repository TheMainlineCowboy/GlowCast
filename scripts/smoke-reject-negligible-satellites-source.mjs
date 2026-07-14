import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const gate = "satellite.width * satellite.height >= parent.width * parent.height * 0.06;";
const count = source.split(gate).length - 1;

if (count !== 2) {
  throw new Error(`expected two negligible-satellite area gates, found ${count}`);
}

console.log("negligible satellite source gate verified");
