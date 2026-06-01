import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

source = source.replace(
  /  for \(const hole of findEnclosedHoles\(edgePoints, projectionZone\)\) \{[\s\S]*?\n  \}\n\n  const cell =/,
  `  // Disabled: hole flood-fill selected random wall, ceiling, and ground blobs.
  // Candidates are now generated only from structural edge components.

  const cell =`
);

source = source.replace("point.strength < 90", "point.strength < 76");
source = source.replace("/ 90);", "/ 70);");
source = source.replace("if (density < 0.35) continue;", "if (density < 0.12) continue;");
source = source.replace("if (cells < 10 || count < 18) continue;", "if (cells < 8 || count < 14) continue;");

writeFileSync(path, source);
console.log("hole blob candidate path disabled; structural edge candidates loosened");
