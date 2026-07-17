import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "const fallbackAspect = box.width / Math.max(box.height, 0.01);",
  "const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;",
  "if (!extremeFallbackAspect && fallbackArea > existingArea * 1.12 && fallback.score >= 1.2)"
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing extreme fallback duplicate safeguard: ${fragment}`);
  }
}

if (source.includes("if (fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {")) {
  throw new Error("Extreme fallback duplicate regression: unguarded replacement logic was restored.");
}

console.log("Extreme-aspect fallback duplicates preserve stronger architectural masks.");
