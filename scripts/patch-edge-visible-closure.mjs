import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replaceAll("point.strength >= 74 &&", "point.strength >= 58 &&");
source = source.replaceAll("  const radius = 2;", "  const radius = 3;");
source = source.replaceAll("if (cells.length < 18) continue;", "if (cells.length < 12) continue;");
source = source.replaceAll("if (fillRatio < 0.20) continue;", "if (fillRatio < 0.14) continue;");
source = source.replaceAll("if (aspect < 0.16 || aspect > 5.5) continue;", "if (aspect < 0.10 || aspect > 7.0) continue;");
source = source.replaceAll("if (accepted.length >= 12) break;", "if (accepted.length >= 16) break;");
source = source.replaceAll(".sort((a, b) => b.area - a.area);", ".sort((a, b) => b.area * b.fillRatio - a.area * a.fillRatio);");
source = source.replaceAll("* 1.18", "* 1.34");
source = source.replaceAll("* 1.08", "* 1.34");
source = source.replaceAll("* 1.24", "* 1.34");

writeFileSync(path, source);
console.log("edge mask closure expands all traced polygon axes toward the outer visible frame");
