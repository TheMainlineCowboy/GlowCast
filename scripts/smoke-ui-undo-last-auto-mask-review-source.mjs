import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'const [autoMaskReviewHistory, setAutoMaskReviewHistory] = useState<Array<{ zone: ProjectZone; action: "approved" | "rejected" }>>([]);',
  'const latestAutoMaskReview = autoMaskReviewHistory[autoMaskReviewHistory.length - 1];',
  'setAutoMaskReviewHistory((history) => [...history.slice(-9), { zone: selectedAutoMask, action: "approved" }]);',
  'setAutoMaskReviewHistory((history) => [...history.slice(-9), { zone: selectedAutoMask, action: "rejected" }]);',
  "const undoLastAutoMaskReview = () => {",
  "const lastReview = autoMaskReviewHistory[autoMaskReviewHistory.length - 1];",
  'if (action === "rejected")',
  'currentZone.id === zone.id ? { ...currentZone, included: false } : currentZone',
  'setSelectedZoneId(zone.id);',
  'setAutoMaskReviewHistory((history) => history.slice(0, -1));',
  'Returned the last approved automatic mask to review.',
  '{latestAutoMaskReview?.action === "approved" ? "Undo Approval" : latestAutoMaskReview?.action === "rejected" ? "Undo Rejection" : "Undo Last Review"} ({autoMaskReviewHistory.length})',
  'disabled={autoMaskReviewHistory.length === 0}',
  'event.key.toLowerCase() === "u" && autoMaskReviewHistory.length > 0',
  'Keyboard: A approve · R/Delete reject · U undo (10 steps)'
];

for (const snippet of required) {
  if (!source.includes(snippet)) {
    throw new Error(`Multi-step review history source smoke missing: ${snippet}`);
  }
}

if (source.includes("lastRejectedAutoMask") || source.includes("lastAutoMaskReview") || source.includes("undoLastAutoMaskRejection")) {
  throw new Error("Legacy single-step automatic-mask undo state remains in App.tsx.");
}

await import("./smoke-ui-auto-mask-undo-canvas-preview-source.mjs");
console.log("Multi-step automatic-mask review history source smoke with visible action label, count, and canvas preview passed.");
