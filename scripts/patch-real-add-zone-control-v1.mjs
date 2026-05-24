import fs from 'node:fs';

const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('function createCandidateMasks()')) {
  const marker = '  function addZone(shape: MaskShape = drawShape) {';
  const fn = `  function createCandidateMasks() {
    setDetectMessage("Automatic candidate masks are disabled. Add a manual rectangle zone, then use magnetic snap to tighten it to the real object edge.");
    return;
  }

`;
  if (!s.includes(marker)) throw new Error('addZone marker not found');
  s = s.replace(marker, fn + marker);
}

if (!s.includes('function snapSelectedZoneToEdges()')) {
  const marker = '  function updateSelectedZone(update: Partial<ProjectZone>) {';
  const fn = `  function snapSelectedZoneToEdges() {
    if (!selectedZone) {
      setDetectMessage("Select an avoid zone first, then snap it to nearby edges.");
      return;
    }

    if (!edgePoints.length) {
      setDetectMessage("Run Show Edge Scanner first, then select a zone and snap it.");
      return;
    }

    const searchPadX = Math.max(3, selectedZone.width * 0.35);
    const searchPadY = Math.max(3, selectedZone.height * 0.35);
    const minX = selectedZone.x - searchPadX;
    const maxX = selectedZone.x + selectedZone.width + searchPadX;
    const minY = selectedZone.y - searchPadY;
    const maxY = selectedZone.y + selectedZone.height + searchPadY;

    const nearby = edgePoints.filter((point) => (
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    ));

    if (nearby.length < 12) {
      setDetectMessage("Not enough nearby edge points found. Move the zone closer to the object edge and try again.");
      return;
    }

    const sortedX = nearby.map((point) => point.x).sort((a, b) => a - b);
    const sortedY = nearby.map((point) => point.y).sort((a, b) => a - b);
    const q = (values: number[], amount: number) => values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * amount)))] ?? 0;

    const left = q(sortedX, 0.08);
    const right = q(sortedX, 0.92);
    const top = q(sortedY, 0.08);
    const bottom = q(sortedY, 0.92);

    const snapped = clampZone({
      ...selectedZone,
      x: left,
      y: top,
      width: Math.max(2, right - left),
      height: Math.max(2, bottom - top),
      shape: selectedZone.shape ?? "rectangle",
      points: undefined
    });

    setZones((current) => current.map((zone) => zone.id === selectedZone.id ? snapped : zone));
    setDetectMessage("Selected zone snapped to nearby edges. Adjust manually if the object edge needs a small correction.");
  }

`;
  if (!s.includes(marker)) throw new Error('updateSelectedZone marker not found');
  s = s.replace(marker, fn + marker);
}

const button = `
              <button type="button" className="primary" onClick={createCandidateMasks} disabled={!imageUrl || cornerMode || surfacePolygonMode}>
                CREATE MASKS FROM CANDIDATES
              </button>
              <p className="helperText">Candidate boxes: {architecturalResult?.candidates.length ?? 0} / Zone count: {zones.length}</p>`;

if (!s.includes('CREATE MASKS FROM CANDIDATES')) {
  const previewText = 'Preview Animation Only';
  const textIndex = s.indexOf(previewText);
  const buttonStart = textIndex >= 0 ? s.lastIndexOf('<button', textIndex) : -1;
  if (buttonStart >= 0) s = s.slice(0, buttonStart) + button + '\n' + s.slice(buttonStart);
  else throw new Error('Preview button marker not found for candidate mask insertion');
} else {
  s = s.replace(
    'disabled={!imageUrl || !architecturalResult?.candidates.length || cornerMode || surfacePolygonMode}',
    'disabled={!imageUrl || cornerMode || surfacePolygonMode}'
  );

  s = s.replace(
    'setDetectMessage("Run Analyze Structural Candidates first.");',
    'setDetectMessage("Automatic candidate masks are disabled. Add a manual rectangle zone, then use magnetic snap to tighten it to the real object edge.");'
  );

  s = s.replace(
    'setDetectMessage("No high-confidence candidate masks found. Add a manual rectangle zone, then use magnetic snap. Auto masks now only create tight connected structures; loose guesses are blocked.");',
    'setDetectMessage("Automatic candidate masks are disabled. Add a manual rectangle zone, then use magnetic snap to tighten it to the real object edge.");'
  );

  s = s.replace(
    'shape: "rectangle" }));',
    'shape: "rectangle" as MaskShape }));'
  );
}

if (!s.includes('Snap Selected Zone to Edges')) {
  const marker = `              <button onClick={() => addZone(drawShape)} disabled={!imageUrl || cornerMode || surfacePolygonMode} >
                <Plus size={18} /> Add {drawShape} Zone
              </button>`;
  const replacement = `${marker}
              <button type="button" onClick={snapSelectedZoneToEdges} disabled={!selectedZone || !edgePoints.length || cornerMode || surfacePolygonMode}>
                <ScanLine size={18} /> Snap Selected Zone to Edges
              </button>`;
  if (!s.includes(marker)) throw new Error('Add zone button marker not found');
  s = s.replace(marker, replacement);
}

fs.writeFileSync(p, s);

const detectorPath = 'src/core/architecturalDetector.ts';

if (fs.existsSync(detectorPath)) {
  let detector = fs.readFileSync(detectorPath, 'utf8');

  detector = detector.replace(
    /const candidates = \[[\s\S]*?\]\s*\.sort\(\(a, b\) => b\.score - a\.score\)[\s\S]*?\.slice\(0, 10\);/m,
    'const candidates: CandidateProposal[] = [];'
  );

  detector = detector.replace(
    /return \{ lines, candidates \};/m,
    'return { lines, candidates: [] };'
  );

  fs.writeFileSync(detectorPath, detector);
}
