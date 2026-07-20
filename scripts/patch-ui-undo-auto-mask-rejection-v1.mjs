import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const stateAnchor = "  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);";
const undoState = "\n  const [lastRejectedAutoMask, setLastRejectedAutoMask] = useState<ProjectZone | null>(null);";
if (!source.includes("lastRejectedAutoMask")) {
  if (!source.includes(stateAnchor)) throw new Error("Selected-zone state anchor not found.");
  source = source.replace(stateAnchor, stateAnchor + undoState);
}

const rejectRemoval = "    setZones((currentZones) => currentZones.filter((zone) => zone.id !== selectedAutoMask.id));";
if (!source.includes("setLastRejectedAutoMask(selectedAutoMask);")) {
  if (!source.includes(rejectRemoval)) throw new Error("Reject removal anchor not found.");
  source = source.replace(rejectRemoval, `    setLastRejectedAutoMask(selectedAutoMask);\n${rejectRemoval}`);
}

const keyboardMarker = "  // Auto-mask review keyboard shortcuts";
const undoFunction = `  const undoLastAutoMaskRejection = () => {\n    if (!lastRejectedAutoMask) return;\n    setZones((currentZones) => currentZones.some((zone) => zone.id === lastRejectedAutoMask.id)\n      ? currentZones\n      : [...currentZones, lastRejectedAutoMask]);\n    setSelectedTarget(\"zone\");\n    setSelectedZoneId(lastRejectedAutoMask.id);\n    setDetectMessage(\"Restored the last rejected automatic mask for review.\");\n    setLastRejectedAutoMask(null);\n  };\n\n`;
if (!source.includes("const undoLastAutoMaskRejection = () =>")) {
  const markerIndex = source.indexOf(keyboardMarker);
  if (markerIndex < 0) throw new Error("Keyboard shortcut anchor not found.");
  source = source.slice(0, markerIndex) + undoFunction + source.slice(markerIndex);
}

if (!source.includes("Undo Last Rejection")) {
  const hint = '<small className="autoMaskReviewShortcutHint" aria-label="Automatic mask review keyboard shortcuts">Keyboard: A approve · R/Delete reject</small>';
  const hintIndex = source.indexOf(hint);
  if (hintIndex < 0) throw new Error("Review shortcut hint anchor not found.");
  const insertionPoint = hintIndex + hint.length;
  const button = `\n              <button type="button" onClick={undoLastAutoMaskRejection} disabled={!lastRejectedAutoMask} aria-label="Restore the most recently rejected automatic mask">\n                Undo Last Rejection\n              </button>`;
  source = source.slice(0, insertionPoint) + button + source.slice(insertionPoint);
}

if (!source.includes('event.key.toLowerCase() === "u"')) {
  const rejectBranch = `      } else if (event.key.toLowerCase() === "r" || event.key === "Delete" || event.key === "Backspace") {\n        event.preventDefault();\n        rejectSelectedAutoMask();\n      }`;
  const replacement = `      } else if (event.key.toLowerCase() === "r" || event.key === "Delete" || event.key === "Backspace") {\n        event.preventDefault();\n        rejectSelectedAutoMask();\n      } else if (event.key.toLowerCase() === "u" && lastRejectedAutoMask) {\n        event.preventDefault();\n        undoLastAutoMaskRejection();\n      }`;
  if (!source.includes(rejectBranch)) throw new Error("Automatic mask keyboard rejection branch not found.");
  source = source.replace(rejectBranch, replacement);
}

source = source.replace(
  "  }, [zones, selectedZoneId]);",
  "  }, [zones, selectedZoneId, lastRejectedAutoMask]);"
);
source = source.replace(
  "Keyboard: A approve · R/Delete reject",
  "Keyboard: A approve · R/Delete reject · U undo"
);

await fs.writeFile(path, source);
console.log("Applied undo-last automatic mask rejection patch with keyboard shortcut.");
