import fs from 'node:fs';

const appPath = 'src/App.tsx';

if (fs.existsSync(appPath)) {
  let app = fs.readFileSync(appPath, 'utf8');

  const fnMarker = '  function updateSelectedZone(update: Partial<ProjectZone>) {';

  const snapFn =
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

  if (!app.includes('function snapSelectedZoneToEdges()')) {
    if (app.includes(fnMarker)) {
      app = app.replace(fnMarker, snapFn + fnMarker);
    } else {
      console.warn('snapSelectedZoneToEdges function marker not found; skipped function insert.');
    }
  }

  const snapButton =
    '              <button type="button" onClick={snapSelectedZoneToEdges} disabled={!selectedZone || !edgePoints.length || cornerMode || surfacePolygonMode} >\n' +
    '                <ScanLine size={18} /> Snap Selected Zone to Edges\n' +
    '              </button>\n';

  if (!app.includes('Snap Selected Zone to Edges') && app.includes('function snapSelectedZoneToEdges()')) {
    const markerTexts = [
      'Add {drawShape} Zone',
      'Preview Animation Only',
      'Draw Avoid Zone'
    ];

    let inserted = false;

    for (const markerText of markerTexts) {
      const textIndex = app.indexOf(markerText);
      if (textIndex < 0) continue;

      const buttonStart = app.lastIndexOf('<button', textIndex);
      if (buttonStart < 0) continue;

      const buttonEnd = app.indexOf('</button>', textIndex);
      if (buttonEnd < 0) continue;

      const insertAt = buttonEnd + '</button>'.length;
      app = app.slice(0, insertAt) + '\n' + snapButton + app.slice(insertAt);
      inserted = true;
      break;
    }

    if (!inserted) {
      console.warn('No safe button insertion marker found; snap button skipped.');
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

console.log('snap selected zone patch completed without fatal marker errors');
