import { readFileSync, writeFileSync } from "node:fs";

const files = ["scripts/patch-stable-edge-masks.mjs", "scripts/patch-edge-candidate-hulls.mjs"];

for (const path of files) {
  let source = readFileSync(path, "utf8");

  source = source.replace(
    /id:\s*`auto_mask_\$\{Date\.now\(\)\}_\$\{index\}`,/g,
    'id: "auto_mask_" + Date.now() + "_" + index,'
  );

  source = source.replace(
    /setDetectMessage\(`Filled \$\{nextCandidates\.length\} closed edge outline\$\{nextCandidates\.length === 1 \? "" : "s"\} into selectable mask candidates\.`\);/g,
    'setDetectMessage("Filled " + nextCandidates.length + " closed edge outline" + (nextCandidates.length === 1 ? "" : "s") + " into selectable mask candidates.");'
  );

  source = source.replace(
    /setDetectMessage\(`Applied \$\{candidates\.length\} edge candidate\$\{candidates\.length === 1 \? "" : "s"\} as real masks\.`\);/g,
    'setDetectMessage("Applied " + candidates.length + " edge candidate" + (candidates.length === 1 ? "" : "s") + " as real masks.");'
  );

  source = source.replaceAll(
    'points={zone.points.map((point) => `${point.x},${point.y}`).join(" ")}',
    'points={zone.points.map((point) => point.x + "," + point.y).join(" ")}'
  );

  source = source.replaceAll(
    'points={zone.points.map((point) => `${zone.x + (point.x * zone.width) / 100},${zone.y + (point.y * zone.height) / 100}`).join(" ")}',
    'points={zone.points.map((point) => (zone.x + (point.x * zone.width) / 100) + "," + (zone.y + (point.y * zone.height) / 100)).join(" ")}'
  );

  writeFileSync(path, source);
}

console.log("fixed unescaped template literals inside edge patch scripts");
