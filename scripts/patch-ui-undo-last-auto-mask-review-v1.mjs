import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

source = source.replace(
  "  const [lastRejectedAutoMask, setLastRejectedAutoMask] = useState<ProjectZone | null>(null);",
  "  const [lastAutoMaskReview, setLastAutoMaskReview] = useState<{ zone: ProjectZone; action: \"approved\" | \"rejected\" } | null>(null);"
);

const approveAnchor = "    setZones((currentZones) => currentZones.map((zone) =>\n      zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone\n    ));";
if (!source.includes('setLastAutoMaskReview({ zone: selectedAutoMask, action: "approved" });')) {
  if (!source.includes(approveAnchor)) throw new Error("Approve action anchor not found.");
  source = source.replace(
    approveAnchor,
    `    setLastAutoMaskReview({ zone: selectedAutoMask, action: "approved" });\n${approveAnchor}`
  );
}

source = source.replace(
  "    setLastRejectedAutoMask(selectedAutoMask);",
  "    setLastAutoMaskReview({ zone: selectedAutoMask, action: \"rejected\" });"
);

const oldUndoStart = source.indexOf("  const undoLastAutoMaskRejection = () => {");
if (oldUndoStart < 0) throw new Error("Existing rejection undo action not found.");
const oldUndoEnd = source.indexOf("\n  };", oldUndoStart);
if (oldUndoEnd < 0) throw new Error("Existing rejection undo action end not found.");

const unifiedUndo = `  const undoLastAutoMaskReview = () => {\n    if (!lastAutoMaskReview) return;\n    const { zone, action } = lastAutoMaskReview;\n    if (action === "rejected") {\n      setZones((currentZones) => currentZones.some((currentZone) => currentZone.id === zone.id)\n        ? currentZones\n        : [...currentZones, zone]);\n    } else {\n      setZones((currentZones) => currentZones.map((currentZone) =>\n        currentZone.id === zone.id ? { ...currentZone, included: false } : currentZone\n      ));\n    }\n    setSelectedTarget("zone");\n    setSelectedZoneId(zone.id);\n    setDetectMessage(action === "rejected"\n      ? "Restored the last rejected automatic mask for review."\n      : "Returned the last approved automatic mask to review.");\n    setLastAutoMaskReview(null);\n  };`;
source = source.slice(0, oldUndoStart) + unifiedUndo + source.slice(oldUndoEnd + "\n  };".length);

source = source.replaceAll("lastRejectedAutoMask", "lastAutoMaskReview");
source = source.replaceAll("undoLastAutoMaskRejection", "undoLastAutoMaskReview");
source = source.replace("Undo Last Rejection", "Undo Last Review");
source = source.replace(
  "Restore the most recently rejected automatic mask",
  "Undo the most recent automatic mask approval or rejection"
);
source = source.replace(
  "Keyboard: A approve · R/Delete reject · U undo",
  "Keyboard: A approve · R/Delete reject · U undo last review"
);

await fs.writeFile(path, source);
console.log("Applied unified automatic-mask review undo patch.");
