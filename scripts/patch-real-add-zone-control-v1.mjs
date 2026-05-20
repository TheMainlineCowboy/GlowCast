import fs from 'node:fs';
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

const marker = `              <button type="button" onClick={toggleEdgeScanner} disabled={!imageUrl || edgeScanning} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                {edgeScanning ? "Scanning Edges..." : showEdges ? "Hide Edge Scanner" : "Show Edge Scanner"}
              </button>`;

const insert = `
              <button type="button" className="primary" onClick={() => addZone("rectangle")} disabled={!imageUrl || cornerMode || surfacePolygonMode}>
                REAL ADD ZONE CONTROL
              </button>
              <p className="helperText">Zone count: {zones.length}</p>`;

if (!s.includes('REAL ADD ZONE CONTROL')) {
  if (!s.includes(marker)) throw new Error('scanner button marker not found');
  s = s.replace(marker, marker + insert);
}

fs.writeFileSync(p, s);
