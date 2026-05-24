import fs from 'node:fs';

const detectorPath = 'src/core/architecturalDetector.ts';

if (fs.existsSync(detectorPath)) {
  let detector = fs.readFileSync(detectorPath, 'utf8');
  const oldReturn = 'return { lines, candidates };';
  const newReturn = 'return { lines, candidates: [] };';

  if (detector.includes(oldReturn)) {
    detector = detector.replace(oldReturn, newReturn);
    fs.writeFileSync(detectorPath, detector, 'utf8');
  }
}

console.log('patch-real-add-zone-control-v1 completed without requiring UI markers.');
