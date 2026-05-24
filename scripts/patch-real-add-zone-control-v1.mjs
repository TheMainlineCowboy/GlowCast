import fs from 'node:fs';

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

const fnMarker = '  function updateSelectedZone(update: Partial<ProjectZone>) {';

const snapFn = `  function snapSelectedZoneToEdges() {
    if (!selectedZone || !edgePoints.length) {
      setDetectMessage("Select a zone and run Show Edge Scanner first.");
      return;
    }

    const radius = Math.max(2, Math.min(selectedZone.width, selectedZone.height) * 0.45);
    const p1 = snapPointToEdge({ x: selectedZone.x, y: selectedZone.y }, edgePoints, radius);
    const p2 = snapPointToEdge({ x: selectedZone.x + selectedZone.width, y: selectedZone.y + selectedZone.height }, edgePoints, radius);

    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const width = Math.max(2, Math.abs(p2.x - p1.x));
    const height = Math.max(2, Math.abs(p2.y - p1.y));

    updateSelectedZone({ x, y, width, height, points: undefined });
    setDetectMessage("Selected zone snapped to nearby edge points.");
  }

`;

if (!app.includes('function snapSelectedZoneToEdges()')) {
  if (!app.includes(fnMarker)) throw new Error('updateSelectedZone marker not found');
  app = app.replace(fnMarker, snapFn + fnMarker);
}

const previewButton =
  '              <button className="primary" onClick={() => { setProjectionOnly((value) => !value); }} disabled={!hasProject} >';

const snapButton =
  '              <button type="button" onClick={snapSelectedZoneToEdges} disabled={!selectedZone || !edgePoints.length || cornerMode || surfacePolygonMode} >\n' +
  '                <ScanLine size={18} /> Snap Selected Zone to Edges\n' +
  '              </button>\n';

if (!app.includes('Snap Selected Zone to Edges')) {
  if (!app.includes(previewButton)) throw new Error('preview button marker not found');
  app = app.replace(previewButton, snapButton + previewButton);
}

fs.writeFileSync(appPath, app, 'utf8');

const detectorPath = 'src/core/architecturalDetector.ts';

if (fs.existsSync(detectorPath)) {
  let detector = fs.readFileSync(detectorPath, 'utf8');
  detector = detector.replace('return { lines, candidates };', 'return { lines, candidates: [] };');
  fs.writeFileSync(detectorPath, detector, 'utf8');
}

console.log('snap control inserted before preview button');
