import fs from 'node:fs';
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('function createFixedWindowMasks()')) {
  const marker = '  function addZone(shape: MaskShape = drawShape) {';
  const fn = `  function createFixedWindowMasks() {
    const base = projectionArea ?? defaultSurface();
    const id = Date.now();
    const masks: ProjectZone[] = [
      clampZone({ id: id + 1, x: base.x + base.width * 0.17, y: base.y + base.height * 0.36, width: base.width * 0.25, height: base.height * 0.23, included: true, label: "edge scan mask", shape: "rectangle" }),
      clampZone({ id: id + 2, x: base.x + base.width * 0.55, y: base.y + base.height * 0.36, width: base.width * 0.25, height: base.height * 0.23, included: true, label: "edge scan mask", shape: "rectangle" }),
      clampZone({ id: id + 3, x: base.x + base.width * 0.33, y: base.y + base.height * 0.14, width: base.width * 0.34, height: base.height * 0.21, included: true, label: "edge scan mask", shape: "rectangle" })
    ];
    setZones((current) => [...current.filter((zone) => zone.label !== "edge scan mask"), ...masks]);
    setSelectedTarget("zone");
    setSelectedZoneId(masks[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setShowEdges(false);
    setDetectMessage("Created 3 fixed window masks.");
  }

`;
  if (!s.includes(marker)) throw new Error('addZone marker not found');
  s = s.replace(marker, fn + marker);
}

const button = `
              <button type="button" className="primary" onClick={createFixedWindowMasks} disabled={!imageUrl || cornerMode || surfacePolygonMode}>
                CREATE FIXED WINDOW MASKS
              </button>
              <p className="helperText">Zone count: {zones.length}</p>`;

if (!s.includes('CREATE FIXED WINDOW MASKS')) {
  const previewText = 'Preview Animation Only';
  const textIndex = s.indexOf(previewText);
  const buttonStart = textIndex >= 0 ? s.lastIndexOf('<button', textIndex) : -1;
  if (buttonStart >= 0) s = s.slice(0, buttonStart) + button + '\n' + s.slice(buttonStart);
  else throw new Error('Preview button marker not found for fixed mask insertion');
}

fs.writeFileSync(p, s);
