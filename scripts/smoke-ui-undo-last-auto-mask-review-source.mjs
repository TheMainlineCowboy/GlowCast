import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'const [lastAutoMaskReview, setLastAutoMaskReview] = useState<{ zone: ProjectZone; action: "approved" | "rejected" } | null>(null);',
  'setLastAutoMaskReview({ zone: selectedAutoMask, action: "approved" });',
  'setLastAutoMaskReview({ zone: selectedAutoMask, action: "rejected" });',
  "const undoLastAutoMaskReview = () => {",
  'if (action === "rejected")',
  'currentZone.id === zone.id ? { ...currentZone, included: false } : currentZone',
  'setSelectedZoneId(zone.id);',
  'Returned the last approved automatic mask to review.',
  'Undo Last Review',
  'disabled={!lastAutoMaskReview}',
  'event.key.toLowerCase() === "u" && lastAutoMaskReview',
  'Keyboard: A approve · R/Delete reject · U undo last review'
];

for (const snippet of required) {
  if (!source.includes(snippet)) {
    throw new Error(`Unified review undo source smoke missing: ${snippet}`);
  }
}

if (source.includes("lastRejectedAutoMask") || source.includes("undoLastAutoMaskRejection")) {
  throw new Error("Legacy rejection-only undo state remains in App.tsx.");
}

console.log("Unified automatic-mask review undo source smoke passed.");
