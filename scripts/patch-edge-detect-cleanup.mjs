import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const oldBlock = `      const bigEnoughObject =
        box.width >= Math.max(7.5, projectionZone.width * 0.105) &&
        box.height >= Math.max(7.5, projectionZone.height * 0.13) &&
        area >= Math.max(70, projectionArea * 0.018);
      return bigEnoughObject && area <= projectionArea * 0.24 && aspect >= 0.25 && aspect <= 4.0;`;

const newBlock = `      const normalWindowObject =
        box.width >= Math.max(7.5, projectionZone.width * 0.105) &&
        box.height >= Math.max(7.5, projectionZone.height * 0.13) &&
        area >= Math.max(70, projectionArea * 0.018);
      const tallDoorOrWindowObject =
        box.width >= Math.max(5.25, projectionZone.width * 0.07) &&
        box.height >= Math.max(12, projectionZone.height * 0.24) &&
        area >= Math.max(70, projectionArea * 0.014);
      const wideWindowObject =
        box.width >= Math.max(12, projectionZone.width * 0.17) &&
        box.height >= Math.max(5.5, projectionZone.height * 0.095) &&
        area >= Math.max(65, projectionArea * 0.013);
      const usefulObject = normalWindowObject || tallDoorOrWindowObject || wideWindowObject;
      return usefulObject && area <= projectionArea * 0.24 && aspect >= 0.2 && aspect <= 4.4;`;

if (!source.includes(oldBlock) && !source.includes(newBlock)) {
  throw new Error("Could not find edge candidate size filter block to patch.");
}

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
}

writeFileSync(path, source);
console.log("edge detector final size filter patched");
