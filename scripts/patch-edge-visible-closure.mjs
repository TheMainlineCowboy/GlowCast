import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replaceAll("point.strength >= 58 &&", "point.strength >= 74 &&");
source = source.replaceAll("  const radius = 3;", "  const radius = 2;");
source = source.replaceAll("if (cells.length < 12) continue;", "if (cells.length < 18) continue;");
source = source.replaceAll("if (fillRatio < 0.14) continue;", "if (fillRatio < 0.20) continue;");
source = source.replaceAll("if (aspect < 0.10 || aspect > 7.0) continue;", "if (aspect < 0.16 || aspect > 5.5) continue;");
source = source.replaceAll("if (accepted.length >= 16) break;", "if (accepted.length >= 12) break;");
source = source.replaceAll(".sort((a, b) => b.area * b.fillRatio - a.area * a.fillRatio);", ".sort((a, b) => b.area - a.area);");
source = source.replaceAll("* 1.34", "* 1.18");
source = source.replaceAll("* 1.24", "* 1.18");
source = source.replaceAll("* 1.08", "* 1.18");

writeFileSync(path, source);
console.log("edge mask closure restored to stable conservative hull settings");
