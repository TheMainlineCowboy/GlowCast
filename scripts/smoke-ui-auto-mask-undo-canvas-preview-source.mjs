import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'className="pendingUndoMaskPreview"',
  'aria-label={`Next undo will reverse the last auto-mask ${latestAutoMaskReview.action}`}',
  '...toStyle(latestAutoMaskReview.zone)',
  'border: "3px dashed #f59e0b"',
  'Undo {latestAutoMaskReview.action === "approved" ? "approval" : "rejection"}'
];

for (const snippet of required) {
  if (!source.includes(snippet)) {
    throw new Error(`Pending undo canvas preview source is missing: ${snippet}`);
  }
}

console.log("Pending automatic-mask undo canvas preview source smoke passed.");
