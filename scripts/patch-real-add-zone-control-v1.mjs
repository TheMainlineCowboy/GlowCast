import fs from 'node:fs';
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('function createFixedWindowMasks()')) {
  const marker = '  function addZone(shape: MaskShape = drawShape) {';
  const fn = `  function createFixedWindowMasks() {
    const base = projectionArea ?? defaultSurface();
    const id = Date.now();
    const masks = [
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
  s = s.replace(marker, fn + marker);
}

s = s.replace('onClick={() => addZone("rectangle")}', 'onClick={createFixedWindowMasks}');
s = s.replace('REAL ADD ZONE CONTROL', 'CREATE FIXED WINDOW MASKS');

fs.writeFileSync(p, s);
