import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const button = `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>`;

const maskStart = source.indexOf('{step === "mask" && (');
if (maskStart === -1) throw new Error("Mask panel not found.");

const magneticIndex = source.indexOf('<label className="flex items-center gap-2 text-sm text-slate-200">', maskStart);
if (magneticIndex === -1) throw new Error("Magnetic snap label not found in mask panel.");

const maskChunk = source.slice(maskStart, magneticIndex);
if (!maskChunk.includes("onClick={createMasksFromEdges}")) {
  source = source.slice(0, magneticIndex) + button + "\n" + source.slice(magneticIndex);
}

writeFileSync(appPath, source);

const detectorPath = "src/edgeDetect.ts";
let detector = readFileSync(detectorPath, "utf8");
const pairs = [
  ["if (inside.length < 22) return null;", "if (inside.length < 30) return null;"],
  ["if (area < 24 || area > projectionArea * 0.16) return null;", "if (area < projectionArea * 0.018 || area > projectionArea * 0.14) return null;"],
  ["if (box.width < projectionZone.width * 0.08 || box.height < projectionZone.height * 0.14) return null;", "if (box.width < projectionZone.width * 0.12 || box.height < projectionZone.height * 0.22) return null;"],
  ["if (box.width > projectionZone.width * 0.42 || box.height > projectionZone.height * 0.42) return null;", "if (box.width > projectionZone.width * 0.38 || box.height > projectionZone.height * 0.46) return null;"],
  ["if (aspect < 0.45 || aspect > 2.65) return null;", "if (aspect < 0.55 || aspect > 2.25) return null;"],
  ["const requiredSideHits = Math.max(4, inside.length * 0.11);", "const requiredSideHits = Math.max(5, inside.length * 0.13);"],
  ["if (centerHits < Math.max(4, inside.length * 0.06)) return null;", "if (centerHits < Math.max(8, inside.length * 0.09)) return null;"],
  ["if (middleVerticalHits < Math.max(5, inside.length * 0.12)) return null;", "if (middleVerticalHits < Math.max(8, inside.length * 0.14)) return null;"],
  ["if (middleHorizontalHits < Math.max(5, inside.length * 0.12)) return null;", "if (middleHorizontalHits < Math.max(8, inside.length * 0.14)) return null;"],
  ["const minW = Math.max(5, projectionZone.width * 0.1);", "const minW = Math.max(5, projectionZone.width * 0.12);"],
  ["const maxW = Math.max(minW + 1, projectionZone.width * 0.34);", "const maxW = Math.max(minW + 1, projectionZone.width * 0.3);"],
  ["const minH = Math.max(6, projectionZone.height * 0.16);", "const minH = Math.max(7, projectionZone.height * 0.22);"],
  ["const maxH = Math.max(minH + 1, projectionZone.height * 0.38);", "const maxH = Math.max(minH + 1, projectionZone.height * 0.42);"],
  ["const stepX = Math.max(1.5, projectionZone.width / 34);", "const stepX = Math.max(1.5, projectionZone.width / 30);"],
  ["const stepY = Math.max(1.5, projectionZone.height / 34);", "const stepY = Math.max(1.5, projectionZone.height / 30);"],
  ["if (accepted.length >= 12) break;", "if (accepted.length >= 6) break;"]
];
for (const [from, to] of pairs) detector = detector.replace(from, to);

detector = detector.replace(
  "  const merged = mergeNearbyPaneBoxes(accepted, projectionZone);\n  return merged.sort((a, b) => b.score - a.score).slice(0, 6);",
  "  const merged = mergeNearbyPaneBoxes(accepted, projectionZone).sort((a, b) => b.score - a.score);\n  const bestScore = merged[0]?.score ?? 0;\n  return merged.filter((candidate) => candidate.score >= bestScore * 0.72).slice(0, 2);"
);

writeFileSync(detectorPath, detector);
