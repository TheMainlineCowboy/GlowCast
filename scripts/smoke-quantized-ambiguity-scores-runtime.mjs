import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const marker = "const quantizeAttachmentScore = (score: number) => Math.round(score * 10000) / 10000;";

if (!adapterSource.includes(marker)) {
  throw new Error("Quantized ambiguity runtime smoke requires prepared quantizeAttachmentScore source.");
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-quantized-ambiguity-runtime-"));
const sourcePath = path.join(tempDir, "quantizeAttachmentScore.ts");
const outDir = path.join(tempDir, "out");

await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, `${marker.replace("const ", "export const ")}\n`);

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc",
  sourcePath,
  "--ignoreConfig",
  "--outDir", outDir,
  "--module", "ES2020",
  "--target", "ES2020",
  "--moduleResolution", "Bundler",
  "--skipLibCheck"
], { stdio: "inherit" });

const emittedPath = path.join(outDir, "quantizeAttachmentScore.js");

try {
  const { quantizeAttachmentScore } = await import(pathToFileURL(emittedPath).href);
  const baseline = quantizeAttachmentScore(0.314159261);
  const insignificantNoise = quantizeAttachmentScore(0.314159269);
  const meaningfulDifference = quantizeAttachmentScore(0.314259269);

  if (baseline !== insignificantNoise) {
    console.error("Quantized ambiguity runtime smoke failed: insignificant floating-point noise remained distinguishable.");
    console.error(JSON.stringify({ baseline, insignificantNoise }, null, 2));
    process.exit(1);
  }

  if (baseline === meaningfulDifference) {
    console.error("Quantized ambiguity runtime smoke failed: meaningful score separation was collapsed.");
    console.error(JSON.stringify({ baseline, meaningfulDifference }, null, 2));
    process.exit(1);
  }

  const ordered = [
    { parentId: "parent-b", score: quantizeAttachmentScore(0.5) },
    { parentId: "parent-a", score: quantizeAttachmentScore(0.5 + Number.EPSILON) }
  ].sort((a, b) => a.score - b.score || a.parentId.localeCompare(b.parentId));

  if (ordered[0].parentId !== "parent-a") {
    console.error("Quantized ambiguity runtime smoke failed: quantized ties did not resolve deterministically by parent identity.");
    console.error(JSON.stringify({ ordered }, null, 2));
    process.exit(1);
  }

  console.log("Quantized ambiguity runtime smoke passed: insignificant noise collapses, meaningful separation remains, and ties resolve deterministically.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
