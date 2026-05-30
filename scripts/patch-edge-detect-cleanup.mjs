import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number };",
  "type AutoMaskOptions = { clusterRadius: number; minPoints: number; tolerance: number; preferredShape?: string };"
);

source = source.replace("pointInsideBox(point, inner) && point.strength >= 92", "pointInsideBox(point, inner) && point.strength >= 45");
source = source.replace("Math.min(projectionZone.width, projectionZone.height) / 95", "Math.min(projectionZone.width, projectionZone.height) / 62");
source = source.replace("if (cells < 8 || edgeCount < 16) continue;", "if (cells < 3 || edgeCount < 5) continue;");
source = source.replace(
  "if (box.width < projectionZone.width * 0.045 || box.height < projectionZone.height * 0.07) continue;",
  "if (box.width < projectionZone.width * 0.018 || box.height < projectionZone.height * 0.025) continue;"
);
source = source.replace("if (area < projectionArea * 0.004 || area > projectionArea * 0.26) continue;", "if (area < projectionArea * 0.001 || area > projectionArea * 0.30) continue;");
source = source.replace("if (aspect < 0.22 || aspect > 4.2) continue;", "if (aspect < 0.10 || aspect > 8.0) continue;");
source = source.replace("if (combinedArea > projectionArea * 0.22) continue;", "if (combinedArea > projectionArea * 0.30) continue;");
source = source.replace("if (combined.width > projectionZone.width * 0.50 || combined.height > projectionZone.height * 0.62) continue;", "if (combined.width > projectionZone.width * 0.65 || combined.height > projectionZone.height * 0.75) continue;");
source = source.replace("if (aspect < 0.24 || aspect > 4.0) continue;", "if (aspect < 0.10 || aspect > 8.0) continue;");
source = source.replace(
  "box.width >= Math.max(7.5, projectionZone.width * 0.105) &&\n        box.height >= Math.max(7.5, projectionZone.height * 0.13) &&\n        area >= Math.max(70, projectionArea * 0.018)",
  "box.width >= Math.max(3.0, projectionZone.width * 0.025) &&\n        box.height >= Math.max(3.0, projectionZone.height * 0.035) &&\n        area >= Math.max(8, projectionArea * 0.0015)"
);
source = source.replace("return bigEnoughObject && area <= projectionArea * 0.24 && aspect >= 0.25 && aspect <= 4.0;", "return bigEnoughObject && area <= projectionArea * 0.30 && aspect >= 0.10 && aspect <= 8.0;");
source = source.replace("if (accepted.length >= 8) break;", "if (accepted.length >= 16) break;");

writeFileSync(path, source);
console.log("edge detector now uses minimal loose threshold candidate filtering");
