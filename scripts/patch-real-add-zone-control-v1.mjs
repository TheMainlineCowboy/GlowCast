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
    '    const padX = Math.max(1.2, selectedZone.width * 0.18);\n' +
    '    const padY = Math.max(1.2, selectedZone.height * 0.18);\n' +
    '    const leftLimit = selectedZone.x - padX;\n' +
    '    const rightLimit = selectedZone.x + selectedZone.width + padX;\n' +
    '    const topLimit = selectedZone.y - padY;\n' +
    '    const bottomLimit = selectedZone.y + selectedZone.height + padY;\n' +
    '\n' +
    '    const localEdges = edgePoints.filter((point) => point.x >= leftLimit && point.x <= rightLimit && point.y >= topLimit && point.y <= bottomLimit);\n' +
    '\n' +
    '    if (localEdges.length < 10) {\n' +
    '      setDetectMessage("Not enough nearby edge points. Move the zone closer to the object and try again.");\n' +
    '      return;\n' +
    '    }\n' +
    '\n' +
    '    const xs = localEdges.map((point) => point.x).sort((a, b) => a - b);\n' +
    '    const ys = localEdges.map((point) => point.y).sort((a, b) => a - b);\n' +
    '    const pick = (values: number[], amount: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * amount)))] ?? 0;\n' +
    '\n' +
    '    const x = pick(xs, 0.10);\n' +
    '    const y = pick(ys, 0.10);\n' +
    '    const right = pick(xs, 0.90);\n' +
    '    const bottom = pick(ys, 0.90);\n' +
    '    const width = Math.max(2, right - x);\n' +
    '    const height = Math.max(2, bottom - y);\n' +
    '\n' +
    '    const oldArea = Math.max(1, selectedZone.width * selectedZone.height);\n' +
    '    const newArea = Math.max(1, width * height);\n' +
    '    const centerX = x + width / 2;\n' +
    '    const centerY = y + height / 2;\n' +
    '    const oldCenterX = selectedZone.x + selectedZone.width / 2;\n' +
    '    const oldCenterY = selectedZone.y + selectedZone.height / 2;\n' +
    '    const centerMove = Math.hypot(centerX - oldCenterX, centerY - oldCenterY);\n' +
    '\n' +
    '    if (newArea < oldArea * 0.18 || newArea > oldArea * 2.75 || centerMove > Math.max(selectedZone.width, selectedZone.height) * 0.45) {\n' +
    '      setDetectMessage("Snap rejected because it would jump too far. Resize the zone closer around the object and try again.");\n' +
    '      return;\n' +
    '    }\n' +
    '\n' +
    '    updateSelectedZone({ x, y, width, height, points: undefined });\n' +
    '    setDetectMessage("Selected zone tightened around nearby edge points.");\n' +
    '  }\n' +
    '\n';

  const oldFunctionStart = app.indexOf('  function snapSelectedZoneToEdges() {');
  const updateFunctionStart = app.indexOf(fnMarker);

  if (oldFunctionStart >= 0 && updateFunctionStart > oldFunctionStart) {
    app = app.slice(0, oldFunctionStart) + snapFn + app.slice(updateFunctionStart);
  } else if (!app.includes('function snapSelectedZoneToEdges()')) {
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

console.log('guided snap behavior updated');
