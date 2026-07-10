import fs from "node:fs/promises";

const detectorPath = "src/core/architecturalDetector.ts";
const adapterPath = "src/core/maskCandidateAdapter.ts";
let detector = await fs.readFile(detectorPath, "utf8");
let adapter = await fs.readFile(adapterPath, "utf8");

if (!detector.includes("fallbackAdded?: number;")) {
  detector = detector.replace(
    "  selected: number;\n}",
    "  selected: number;\n  fallbackAdded?: number;\n  fallbackReplaced?: number;\n  satelliteGrouped?: number;\n  finalMasks?: number;\n}"
  );
}

const oldBlock = `  const limits = getAdapterDetectorLimits(bounds);\n  const found = detectArchitecturalCandidates(edgePoints, { bounds, ...limits, onDiagnostics });\n  const accepted: MaskCandidateOutput[] = [];`;
const newBlock = `  const limits = getAdapterDetectorLimits(bounds);\n  let detectorDiagnostics: DetectorDiagnostics | undefined;\n  const found = detectArchitecturalCandidates(edgePoints, {\n    bounds,\n    ...limits,\n    onDiagnostics: (diagnostics) => {\n      detectorDiagnostics = diagnostics;\n    }\n  });\n  const accepted: MaskCandidateOutput[] = [];`;

if (!adapter.includes("let detectorDiagnostics: DetectorDiagnostics | undefined;")) {
  if (!adapter.includes(oldBlock)) throw new Error("adapter diagnostics insertion point not found");
  adapter = adapter.replace(oldBlock, newBlock);
}

const oldReturn = `  return groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds).slice(0, 10);`;
const newReturn = `  const withFallback = addFallbackCandidates(accepted, edgePoints, bounds);\n  const fallbackAdded = withFallback.filter((candidate) => candidate.id.startsWith("mask_fallback_")).length;\n  const fallbackReplaced = accepted.filter((candidate) => {\n    const replacement = withFallback.find((next) => next.id === candidate.id);\n    return Boolean(\n      replacement &&\n        (replacement.box.x !== candidate.box.x ||\n          replacement.box.y !== candidate.box.y ||\n          replacement.box.width !== candidate.box.width ||\n          replacement.box.height !== candidate.box.height)\n    );\n  }).length;\n  const grouped = groupNearbySatellites(withFallback, bounds);\n  const finalMasks = grouped.slice(0, 10);\n\n  if (onDiagnostics && detectorDiagnostics) {\n    onDiagnostics({\n      ...detectorDiagnostics,\n      fallbackAdded,\n      fallbackReplaced,\n      satelliteGrouped: Math.max(0, withFallback.length - grouped.length),\n      finalMasks: finalMasks.length\n    });\n  }\n\n  return finalMasks;`;

if (!adapter.includes("fallbackAdded = withFallback.filter")) {
  if (!adapter.includes(oldReturn)) throw new Error("adapter diagnostics return point not found");
  adapter = adapter.replace(oldReturn, newReturn);
}

await fs.writeFile(detectorPath, detector);
await fs.writeFile(adapterPath, adapter);
console.log("adapter recovery diagnostics patch applied");
