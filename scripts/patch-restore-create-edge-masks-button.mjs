import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const button = `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Masks
              </button>`;

const maskStart = source.indexOf('{step === "mask" && (');
if (maskStart === -1) throw new Error("Mask panel not found.");

const magneticIndex = source.indexOf('<label className="flex items-center gap-2 text-sm text-slate-200">', maskStart);
if (magneticIndex === -1) throw new Error("Magnetic snap label not found in mask panel.");

const maskChunk = source.slice(maskStart, magneticIndex);
if (!maskChunk.includes("onClick={createMasksFromEdges}")) {
  source = source.slice(0, magneticIndex) + button + "\n" + source.slice(magneticIndex);
}

writeFileSync(path, source);
