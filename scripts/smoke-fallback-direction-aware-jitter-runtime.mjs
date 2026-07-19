import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas.length",
  "0.4 + 0.6 * secondaryGapDirectionalConsistency",
  "secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Direction-aware jitter patch incomplete: ${JSON.stringify(missing)}`);

function support(gapValues, denseMedianSpacing = 8, dimension = 640) {
  const deltas = gapValues.slice(1).map((gap, index) => gap - gapValues[index]);
  const direction = deltas.reduce(
    (sum, delta) => sum + (Math.abs(delta) < 0.25 ? 0 : Math.sign(delta)),
    0
  );
  const directionalConsistency = deltas.length ? Math.abs(direction) / deltas.length : 0;
  const deltaMean = deltas.length
    ? deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length
    : 0;
  const deltaVariance = deltas.length >= 3
    ? deltas.reduce((sum, delta) => sum + Math.pow(Math.abs(delta) - deltaMean, 2), 0) / deltas.length
    : 0;
  const samplingAllowance = Math.min(1.25, Math.max(0, denseMedianSpacing * 0.12));
  const directionalAllowance = deltas.length ? 0.4 + 0.6 * directionalConsistency : 0.4;
  const scaleAllowance = Math.min(
    2.5,
    Math.max(0.5, dimension * 0.003 + samplingAllowance * directionalAllowance)
  );
  const jitterAllowance = Math.min(
    Math.max(scaleAllowance, deltaMean * 0.2),
    Math.max(scaleAllowance, deltaMean * 0.35)
  );
  const residual = Math.sqrt(Math.max(0, deltaVariance - Math.pow(jitterAllowance, 2)));
  const smoothness = Math.max(0, 1 - residual / Math.max(deltaMean * 0.75, 0.5));
  const rangeRatio = (Math.max(...gapValues) - Math.min(...gapValues)) /
    Math.max(gapValues.reduce((sum, gap) => sum + gap, 0) / gapValues.length, 1);
  return Math.min(1, directionalConsistency * smoothness * rangeRatio * 2.5);
}

const consistentPerspective = support([40, 32, 27, 16]);
const oscillatingSparseNoise = support([40, 31, 38, 16]);
const severeStep = support([40, 39, 38, 16]);

if (!(consistentPerspective > oscillatingSparseNoise)) {
  throw new Error(`Consistent sparse perspective must outrank oscillating noise: perspective=${consistentPerspective}, noise=${oscillatingSparseNoise}`);
}
if (!(consistentPerspective > severeStep)) {
  throw new Error(`Consistent sparse perspective must outrank a severe step: perspective=${consistentPerspective}, step=${severeStep}`);
}
if (!(consistentPerspective <= 1 && oscillatingSparseNoise >= 0)) {
  throw new Error("Direction-aware perspective support must remain normalized.");
}

console.log("Direction-aware jitter smoke passed: consistent sparse perspective outranks oscillating and stepped patterns.");
