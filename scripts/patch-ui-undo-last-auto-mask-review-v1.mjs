import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

source = source.replace(
  "  const [lastRejectedAutoMask, setLastRejectedAutoMask] = useState<ProjectZone | null>(null);",
  "  const [autoMaskReviewHistory, setAutoMaskReviewHistory] = useState<Array<{ zone: ProjectZone; action: \"approved\" | \"rejected\" }>>([]);"
);

const reviewHistoryState = '  const [autoMaskReviewHistory, setAutoMaskReviewHistory] = useState<Array<{ zone: ProjectZone; action: "approved" | "rejected" }>>([]);';
const latestReviewState = '  const latestAutoMaskReview = autoMaskReviewHistory[autoMaskReviewHistory.length - 1];';
if (!source.includes(latestReviewState)) {
  if (!source.includes(reviewHistoryState)) throw new Error("Review history state anchor not found.");
  source = source.replace(reviewHistoryState, `${reviewHistoryState}\n${latestReviewState}`);
}

const approveAnchor = "    setZones((currentZones) => currentZones.map((zone) =>\n      zone.id === selectedAutoMask.id ? { ...zone, included: true } : zone\n    ));";
if (!source.includes('setAutoMaskReviewHistory((history) => [...history.slice(-9), { zone: selectedAutoMask, action: "approved" }]);')) {
  if (!source.includes(approveAnchor)) throw new Error("Approve action anchor not found.");
  source = source.replace(approveAnchor, `    setAutoMaskReviewHistory((history) => [...history.slice(-9), { zone: selectedAutoMask, action: "approved" }]);\n${approveAnchor}`);
}

source = source.replace("    setLastRejectedAutoMask(selectedAutoMask);", "    setAutoMaskReviewHistory((history) => [...history.slice(-9), { zone: selectedAutoMask, action: \"rejected\" }]);");

const historyUndo = `  const undoLastAutoMaskReview = () => {\n    const lastReview = autoMaskReviewHistory[autoMaskReviewHistory.length - 1];\n    if (!lastReview) return;\n    const { zone, action } = lastReview;\n    if (action === "rejected") {\n      setZones((currentZones) => currentZones.some((currentZone) => currentZone.id === zone.id) ? currentZones : [...currentZones, zone]);\n    } else {\n      setZones((currentZones) => currentZones.map((currentZone) => currentZone.id === zone.id ? { ...currentZone, included: false } : currentZone));\n    }\n    setSelectedTarget("zone");\n    setSelectedZoneId(zone.id);\n    setDetectMessage(action === "rejected" ? "Restored the last rejected automatic mask for review." : "Returned the last approved automatic mask to review.");\n    setAutoMaskReviewHistory((history) => history.slice(0, -1));\n  };`;
if (!source.includes("  const undoLastAutoMaskReview = () => {")) {
  const oldUndoStart = source.indexOf("  const undoLastAutoMaskRejection = () => {");
  if (oldUndoStart < 0) throw new Error("Existing rejection undo action not found.");
  const oldUndoEnd = source.indexOf("\n  };", oldUndoStart);
  if (oldUndoEnd < 0) throw new Error("Existing rejection undo action end not found.");
  source = source.slice(0, oldUndoStart) + historyUndo + source.slice(oldUndoEnd + "\n  };".length);
}

source = source.replaceAll("!lastRejectedAutoMask", "autoMaskReviewHistory.length === 0");
source = source.replaceAll("lastRejectedAutoMask", "autoMaskReviewHistory.length > 0");
source = source.replaceAll("undoLastAutoMaskRejection", "undoLastAutoMaskReview");
source = source.replace("Undo Last Rejection", "Undo Last Review");
source = source.replace("Restore the most recently rejected automatic mask", "Undo up to the 10 most recent automatic mask approvals or rejections");
source = source.replace("Keyboard: A approve · R/Delete reject · U undo", "Keyboard: A approve · R/Delete reject · U undo (10 steps)");
source = source.replace("                Undo Last Review\n", "                Undo Last Review ({autoMaskReviewHistory.length})\n");
source = source.replace("                Undo Last Review ({autoMaskReviewHistory.length})\n", "                {latestAutoMaskReview?.action === \"approved\" ? \"Undo Approval\" : latestAutoMaskReview?.action === \"rejected\" ? \"Undo Rejection\" : \"Undo Last Review\"} ({autoMaskReviewHistory.length})\n");

const previewAnchor = "          {draftRect && !projectionOnly && !cornerMode && !surfacePolygonMode && (";
if (!source.includes(previewAnchor)) throw new Error("Draft-zone canvas render anchor not found.");
const preview = [
  "          {!projectionOnly && !cornerMode && !surfacePolygonMode && latestAutoMaskReview ? (",
  "            <div className=\"pendingUndoMaskPreview\" aria-label={`Next undo will reverse the last auto-mask ${latestAutoMaskReview.action}`} style={{ ...toStyle(latestAutoMaskReview.zone), position: \"absolute\", zIndex: 12, pointerEvents: \"none\", border: \"3px dashed #f59e0b\", boxShadow: \"0 0 0 3px rgba(15, 23, 42, 0.85), 0 0 24px rgba(245, 158, 11, 0.75)\" }}>",
  "              <span style={{ position: \"absolute\", left: 6, top: 6, padding: \"3px 7px\", borderRadius: 999, background: \"rgba(15, 23, 42, 0.92)\", color: \"#fbbf24\", fontSize: 12, fontWeight: 800 }}>",
  "                Undo {latestAutoMaskReview.action === \"approved\" ? \"approval\" : \"rejection\"}",
  "              </span>",
  "            </div>",
  "          ) : null}",
  "",
  ""
].join("\n");
if (!source.includes('className="pendingUndoMaskPreview"')) source = source.replace(previewAnchor, preview + previewAnchor);

await fs.writeFile(path, source);
console.log("Applied multi-step automatic-mask review history with visible action label, count, and canvas preview.");