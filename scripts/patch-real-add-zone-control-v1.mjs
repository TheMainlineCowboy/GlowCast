import fs from 'node:fs';

const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('function createCandidateMasks()')) {
  const marker = '  function addZone(shape: MaskShape = drawShape) {';
  const fn = `  function createCandidateMasks() {
    if (!architecturalResult?.candidates.length) {
      setDetectMessage("No high-confidence candidate masks found. Add a manual rectangle zone, then use magnetic snap. Auto masks now only create tight connected structures; loose guesses are blocked.");
      return;
    }
    const id = Date.now();
    const masks: ProjectZone[] = architecturalResult.candidates.slice(0, 12).map((c, i) => clampZone({ id: id + i, x: c.x, y: c.y, width: c.width, height: c.height, included: true, label: "candidate mask", shape: "rectangle" as MaskShape }));
    setZones((current) => [...current.filter((zone) => zone.label !== "candidate mask"), ...masks]);
    setSelectedTarget("zone");
    setSelectedZoneId(masks[0].id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setShowEdges(false);
    setArchitecturalDebug(false);
    setDetectMessage("Created " + masks.length + " high-confidence masks from connected edge structures.");
  }

`;
  if (!s.includes(marker)) throw new Error('addZone marker not found');
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
    'setDetectMessage("No high-confidence candidate masks found. Add a manual rectangle zone, then use magnetic snap. Auto masks now only create tight connected structures; loose guesses are blocked.");'
  );

  s = s.replace(
    'shape: "rectangle" }));',
    'shape: "rectangle" as MaskShape }));'
  );
}

fs.writeFileSync(p, s);

const detectorPath = 'src/core/architecturalDetector.ts';

if (fs.existsSync(detectorPath)) {
  let detector = fs.readFileSync(detectorPath, 'utf8');

  detector = detector.replace(
    'const candidates = [...componentCandidates(points, lines, surface), ...linePairCandidates(points, lines, surface), ...edgeDensityGridCandidates(points, lines, surface)]',
    'const candidates = [...componentCandidates(points, lines, surface)]'
  );

  detector = detector.replace(
    'const candidates = [...componentCandidates(points, lines, surface), ...linePairCandidates(points, lines, surface)]',
    'const candidates = [...componentCandidates(points, lines, surface)]'
  );

  fs.writeFileSync(detectorPath, detector);
}
