import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);")) {
  console.log("Balanced mullion pane scoring already present.");
} else {
  const before = `          const verticalMullionClearDensity = (leftInterior + rightInterior) / 2;
          const horizontalMullionClearDensity = (topInterior + bottomInterior) / 2;
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);`;

  const after = `          const verticalMullionClearDensity = Math.max(leftInterior, rightInterior);
          const horizontalMullionClearDensity = Math.max(topInterior, bottomInterior);
          const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity);`;

  if (!source.includes(before)) {
    throw new Error("Balanced mullion pane scoring anchor not found.");
  }

  source = source.replace(before, after);
  await fs.writeFile(path, source);
  console.log("Required both panes around a tolerated mullion to remain credibly hollow.");
}
