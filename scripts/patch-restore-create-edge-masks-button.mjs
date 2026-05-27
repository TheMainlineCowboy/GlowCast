import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const anchor = `              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>`;

const button = `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>`;

const anchorIndex = source.indexOf(anchor);
if (anchorIndex === -1) {
  throw new Error("Could not restore Create Edge Masks button: Edge Scanner button anchor not found.");
}

const nextChunk = source.slice(anchorIndex, anchorIndex + 900);
if (!nextChunk.includes("onClick={createMasksFromEdges}")) {
  source = source.slice(0, anchorIndex + anchor.length) + "\n" + button + source.slice(anchorIndex + anchor.length);
}

writeFileSync(path, source);
