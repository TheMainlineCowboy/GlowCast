import { readFileSync, writeFileSync } from "node:fs";

for (const path of ["scripts/patch-stable-edge-masks.mjs", "scripts/patch-edge-candidate-hulls.mjs"]) {
  let source = readFileSync(path, "utf8");

  source = source.replaceAll(
    'id: `auto_mask_${Date.now()}_${index}`,',
    'id: "auto_mask_" + Date.now() + "_" + index,'
  );

  source = source.replaceAll(
    'setDetectMessage(`Filled ${nextCandidates.length} closed edge outline${nextCandidates.length === 1 ? "" : "s"} into selectable mask candidates.`);',
    'setDetectMessage("Filled " + nextCandidates.length + " closed edge outline" + (nextCandidates.length === 1 ? "" : "s") + " into selectable mask candidates.");'
  );

  source = source.replaceAll(
    'setDetectMessage(`Applied ${candidates.length} edge candidate${candidates.length === 1 ? "" : "s"} as real masks.`);',
    'setDetectMessage("Applied " + candidates.length + " edge candidate" + (candidates.length === 1 ? "" : "s") + " as real masks.");'
  );

  writeFileSync(path, source);
}

console.log("fixed unescaped template literals inside edge patch scripts");
