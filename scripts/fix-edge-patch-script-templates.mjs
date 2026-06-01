import { readFileSync, writeFileSync } from "node:fs";

for (const path of ["scripts/patch-stable-edge-masks.mjs", "scripts/patch-edge-candidate-hulls.mjs"]) {
  let source = readFileSync(path, "utf8");
  source = source.replaceAll('id: `auto_mask_${Date.now()}_${index}`,', 'id: "auto_mask_" + Date.now() + "_" + index,');
  writeFileSync(path, source);
}

console.log("fixed unescaped auto_mask template literals inside edge patch scripts");
