import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const anchor = "          {!projectionOnly && !cornerMode && !surfacePolygonMode && zones.map((zone, index) => (";
if (!source.includes(anchor)) throw new Error("Mask canvas render anchor not found.");

const preview = [
  "          {!projectionOnly && !cornerMode && !surfacePolygonMode && latestAutoMaskReview ? (",
  "            <div",
  "              className=\"pendingUndoMaskPreview\"",
  "              aria-label={`Next undo will reverse the last auto-mask ${latestAutoMaskReview.action}`}",
  "              style={{",
  "                ...toStyle(latestAutoMaskReview.zone),",
  "                position: \"absolute\",",
  "                zIndex: 12,",
  "                pointerEvents: \"none\",",
  "                border: \"3px dashed #f59e0b\",",
  "                boxShadow: \"0 0 0 3px rgba(15, 23, 42, 0.85), 0 0 24px rgba(245, 158, 11, 0.75)\",",
  "                ...(latestAutoMaskReview.zone.points ? { clipPath: `polygon(${latestAutoMaskReview.zone.points.map((p) => `${p.x}% ${p.y}%`).join(\",\")})` } : {})",
  "              }}",
  "            >",
  "              <span style={{ position: \"absolute\", left: 6, top: 6, padding: \"3px 7px\", borderRadius: 999, background: \"rgba(15, 23, 42, 0.92)\", color: \"#fbbf24\", fontSize: 12, fontWeight: 800 }}>",
  "                Undo {latestAutoMaskReview.action === \"approved\" ? \"approval\" : \"rejection\"}",
  "              </span>",
  "            </div>",
  "          ) : null}",
  "",
  ""
].join("\n");

if (!source.includes('className="pendingUndoMaskPreview"')) {
  source = source.replace(anchor, preview + anchor);
}

await fs.writeFile(path, source);
console.log("Applied pending automatic-mask undo canvas preview.");
