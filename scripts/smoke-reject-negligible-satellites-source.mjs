import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const gate = "if (satelliteArea < parentArea * 0.06) return false;";
const count = source.split(gate).length - 1;

if (count !== 1) {
  throw new Error(`expected one negligible-satellite area guard, found ${count}`);
}

console.log("negligible satellite source gate verified");
