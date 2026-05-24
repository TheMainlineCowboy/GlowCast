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
