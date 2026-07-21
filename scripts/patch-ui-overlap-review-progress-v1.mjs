import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const progressMarker = "  const overlapReviewPosition = selectedZoneId === null";
if (!source.includes(progressMarker)) {
  const anchor = `  const selectedRetainedOverlapId = selectedZoneId === null
    ? null
    : retainedOverlapByRemovedId.get(selectedZoneId) ?? null;
`;
  if (!source.includes(anchor)) throw new Error("Selected overlap pair anchor not found for progress indicator.");
  const progress = `${anchor}
  const overlapReviewPosition = selectedZoneId === null
    ? null
    : zones
        .filter((zone) => overlappingAutoMaskIds.has(zone.id))
        .findIndex((zone) => zone.id === selectedZoneId) + 1;
`;
  source = source.replace(anchor, progress);
}

const oldLabel = "                Review Overlaps ({overlappingAutoMaskIds.size})";
const newLabel = `                {overlapReviewPosition && overlapReviewPosition > 0
                  ? \`Pair \${overlapReviewPosition} of \${overlappingAutoMaskIds.size}\`
                  : \`Review Overlaps (\${overlappingAutoMaskIds.size})\`}`;
if (!source.includes("Pair ${overlapReviewPosition} of ${overlappingAutoMaskIds.size}")) {
  if (!source.includes(oldLabel)) throw new Error("Review Overlaps label anchor not found for pair progress.");
  source = source.replace(oldLabel, newLabel);
}

await fs.writeFile(path, source);
console.log("Applied overlap review pair progress indicator.");
