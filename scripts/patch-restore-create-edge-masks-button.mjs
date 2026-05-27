import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

if (!source.includes("Create Edge Masks")) {
  const anchor = `              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>`;

  const insert = `${anchor}
              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>`;

  if (!source.includes(anchor)) {
    throw new Error("Could not restore Create Edge Masks button: Edge Scanner button anchor not found.");
  }

  source = source.replace(anchor, insert);
}

writeFileSync(path, source);
