import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldTolerance = "  const tolerance = Math.max(1.2, Math.min(box.width, box.height) * 0.09);";
const marker = "The previous 9% tolerance";

if (source.includes(marker) && !source.includes(oldTolerance)) {
  console.log("Fallback side tolerance scaling already applied.");
  process.exit(0);
}

if (!source.includes(oldTolerance)) {
  throw new Error("Fallback side tolerance anchor not found.");
}

source = source.replace(
  oldTolerance,
  `  // Match horizontal and vertical sides independently. The previous 9% tolerance
  // became broad enough on large components for inset trim, wall seams, or neighboring
  // frame detail to close a fallback mask. Scale slowly with resolution and cap at
  // eight pixels so evidence must remain close to the actual architectural perimeter.
  const horizontalSideTolerance = Math.min(8, Math.max(1.2, box.height / 240));
  const verticalSideTolerance = Math.min(8, Math.max(1.2, box.width / 240));`
);

source = source
  .replace("box.x - tolerance", "box.x - verticalSideTolerance")
  .replace("box.x + box.width + tolerance", "box.x + box.width + verticalSideTolerance")
  .replace("box.y - tolerance", "box.y - horizontalSideTolerance")
  .replace("box.y + box.height + tolerance", "box.y + box.height + horizontalSideTolerance")
  .replace("Math.abs(point.y - box.y) <= tolerance", "Math.abs(point.y - box.y) <= horizontalSideTolerance")
  .replace("Math.abs(point.y - (box.y + box.height)) <= tolerance", "Math.abs(point.y - (box.y + box.height)) <= horizontalSideTolerance")
  .replace("Math.abs(point.x - box.x) <= tolerance", "Math.abs(point.x - box.x) <= verticalSideTolerance")
  .replace("Math.abs(point.x - (box.x + box.width)) <= tolerance", "Math.abs(point.x - (box.x + box.width)) <= verticalSideTolerance");

if (!source.includes(marker) || source.includes(oldTolerance)) {
  throw new Error("Fallback side tolerance scaling was not applied.");
}

await fs.writeFile(path, source);
console.log("Scaled fallback side coverage tolerance by axis and image resolution.");
