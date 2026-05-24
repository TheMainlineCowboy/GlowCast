import fs from 'node:fs';

const appPath = 'src/App.tsx';

if (fs.existsSync(appPath)) {
  let app = fs.readFileSync(appPath, 'utf8');

  if (!app.includes('function snapSelectedZoneToEdges()')) {
    const marker = '  function updateSelectedZone(update: Partial<ProjectZone>) {';

    const fn =
      '  function snapSelectedZoneToEdges() {\n' +
      '    if (!selectedZone || !edgePoints.length) {\n' +
      '      setDetectMessage("Select a zone and run Show Edge Scanner first.");\n' +
      '      return;\n' +
      '    }\n' +
      '\n' +
      '    const radius = Math.max(2, Math.min(selectedZone.width, selectedZone.height) * 0.45);\n' +
      '    const p1 = snapPointToEdge({ x: selectedZone.x, y: selectedZone.y }, edgePoints, radius);\n' +
      '    const p2 = snapPointToEdge({ x: selectedZone.x + selectedZone.width, y: selectedZone.y + selectedZone.height }, edgePoints, radius);\n' +
      '\n' +
      '    const x = Math.min(p1.x, p2.x);\n' +
      '    const y = Math.min(p1.y, p2.y);\n' +
      '    const width = Math.max(2, Math.abs(p2.x - p1.x));\n' +
      '    const height = Math.max(2, Math.abs(p2.y - p1.y));\n' +
      '\n' +
      '    updateSelectedZone({ x, y, width, height, points: undefined });\n' +
      '    setDetectMessage("Selected zone snapped to nearby edge points.");\n' +
      '  }\n' +
      '\n';

    if (app.includes(marker)) {
      app = app.replace(marker, fn + marker);
    } else {
      console.warn('snapSelectedZoneToEdges marker not found. Function was not inserted.');
    }
  }

  if (!app.includes('Snap Selected Zone to Edges')) {
    const oldButton =
      '              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode} >\n' +
      '                <Plus size={18} /> Add {drawShape} Zone\n' +
      '              </button>';

    const newButton =
      oldButton +
      '\n' +
      '              <button type="button" onClick={snapSelectedZoneToEdges} disabled={!selectedZone || !edgePoints.length || cornerMode || surfacePolygonMode} >\n' +
      '                <ScanLine size={18} /> Snap Selected Zone to Edges\n' +
      '              </button>';

    if (app.includes(oldButton)) {
      app = app.replace(oldButton, newButton);
    } else {
      console.warn('Add zone button marker not found. Snap button was not inserted.');
    }
  }

  fs.writeFileSync(appPath, app, 'utf8');
}

const detectorPath = 'src/core/architecturalDetector.ts';

if (fs.existsSync(detectorPath)) {
  let detector = fs.readFileSync(detectorPath, 'utf8');

  detector = detector.replace(
    'return { lines, candidates };',
    'return { lines, candidates: [] };'
  );

  fs.writeFileSync(detectorPath, detector, 'utf8');
}

console.log('snap selected zone build patch completed');
