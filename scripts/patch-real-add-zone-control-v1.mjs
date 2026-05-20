import fs from 'node:fs';
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

const insert = `
              <button type="button" className="primary" onClick={() => addZone("rectangle")} disabled={!imageUrl || cornerMode || surfacePolygonMode}>
                REAL ADD ZONE CONTROL
              </button>
              <p className="helperText">Zone count: {zones.length}</p>`;

if (!s.includes('REAL ADD ZONE CONTROL')) {
  const addZoneText = '<Plus size={18} /> Add {drawShape} Zone';
  const textIndex = s.indexOf(addZoneText);
  if (textIndex >= 0) {
    const buttonStart = s.lastIndexOf('<button', textIndex);
    if (buttonStart >= 0) {
      s = s.slice(0, buttonStart) + insert + '\n' + s.slice(buttonStart);
    } else {
      console.warn('REAL ADD ZONE CONTROL skipped: button start not found');
    }
  } else {
    console.warn('REAL ADD ZONE CONTROL skipped: Add Zone text not found');
  }
}

fs.writeFileSync(p, s);
