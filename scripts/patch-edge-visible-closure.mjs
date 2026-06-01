import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace("point.strength >= 74 &&", "point.strength >= 58 &&");
source = source.replace("  const radius = 2;", "  const radius = 3;");
source = source.replace("if (cells.length < 18) continue;", "if (cells.length < 12) continue;");
source = source.replace("if (fillRatio < 0.20) continue;", "if (fillRatio < 0.14) continue;");
source = source.replace("if (aspect < 0.16 || aspect > 5.5) continue;", "if (aspect < 0.10 || aspect > 7.0) continue;");
source = source.replace("if (accepted.length >= 12) break;", "if (accepted.length >= 16) break;");
source = source.replace(".sort((a, b) => b.area - a.area);", ".sort((a, b) => b.area * b.fillRatio - a.area * a.fillRatio);");
source = source.replace("* 1.18", "* 1.08");

writeFileSync(path, source);
console.log("edge mask closure now uses the visible edge scan more aggressively");
