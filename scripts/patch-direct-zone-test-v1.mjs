import fs from 'node:fs';
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('directAppZoneTest')) {
  const marker = '  function addZone(shape: MaskShape = drawShape) {';
  const fn = '  function directAppZoneTest() {\n' +
    '    addZone("rectangle");\n' +
    '    setShowEdges(false);\n' +
    '    setDetectMessage("DIRECT APP ZONE TEST fired through real addZone.");\n' +
    '  }\n\n';
  s = s.replace(marker, fn + marker);
}

if (!s.includes('DIRECT APP ZONE TEST')) {
  const marker = '              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode} >';
  const button = '              <button type="button" className="primary" onClick={directAppZoneTest} disabled={!imageUrl}>\n' +
    '                DIRECT APP ZONE TEST\n' +
    '              </button>\n' +
    '              <p className="helperText">Zone count: {zones.length}</p>\n';
  s = s.replace(marker, button + marker);
}

fs.writeFileSync(p, s);
