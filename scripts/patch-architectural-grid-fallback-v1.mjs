import fs from 'node:fs';

const p = 'src/core/architecturalDetector.ts';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('function edgeDensityGridCandidates(')) {
  const insertBefore = 'export function detectArchitecturalCandidates';
  const gridFn = `
function edgeDensityGridCandidates(points: EdgePoint[], lines: LineSegment[], surface: Bounds) {
  if (points.length < 10) return [] as CandidateProposal[];
  const cols = 14;
  const rows = 10;
  const cellW = surface.width / cols;
  const cellH = surface.height / rows;
  const strengths = points.map((point) => point.strength).sort((a, b) => a - b);
  const cutoff = strengths[Math.floor(strengths.length * 0.48)] ?? 0;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ count: 0, strength: 0 })));

  for (const point of points) {
    if (point.strength < cutoff) continue;
    const cx = Math.max(0, Math.min(cols - 1, Math.floor((point.x - surface.x) / cellW)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor((point.y - surface.y) / cellH)));
    grid[cy][cx].count++;
    grid[cy][cx].strength += point.strength;
  }

  const active = grid.map((row) => row.map((cell) => cell.count >= 2 || cell.strength >= cutoff * 2.2));
  const candidates: CandidateProposal[] = [];
  let id = 0;

  for (let y0 = 0; y0 < rows; y0++) {
    for (let x0 = 0; x0 < cols; x0++) {
      for (let w = 2; w <= 6; w++) {
        for (let h = 2; h <= 7; h++) {
          if (x0 + w > cols || y0 + h > rows) continue;
          const x = surface.x + x0 * cellW;
          const y = surface.y + y0 * cellH;
          const width = w * cellW;
          const height = h * cellH;
          const aspect = width / Math.max(0.001, height);
          const doorLike = aspect >= 0.22 && aspect <= 0.85 && height >= surface.height * 0.28;
          const windowLike = aspect >= 0.55 && aspect <= 2.2 && height <= surface.height * 0.52;
          const wideLike = aspect > 1.5 && aspect <= 4.8 && height <= surface.height * 0.32;
          if (!doorLike && !windowLike && !wideLike) continue;

          let activeCells = 0;
          let totalCells = 0;
          let borderActive = 0;
          let interiorActive = 0;
          for (let yy = y0; yy < y0 + h; yy++) {
            for (let xx = x0; xx < x0 + w; xx++) {
              const isActive = active[yy][xx];
              totalCells++;
              if (isActive) activeCells++;
              const border = yy === y0 || yy === y0 + h - 1 || xx === x0 || xx === x0 + w - 1;
              if (isActive && border) borderActive++;
              if (isActive && !border) interiorActive++;
            }
          }
          if (activeCells < 3) continue;
          if (borderActive < 2) continue;
          if (activeCells / totalCells > 0.72) continue;

          const hLines = lineSupport(lines, x, y, width, height, "horizontal");
          const vLines = lineSupport(lines, x, y, width, height, "vertical");
          if (hLines < 1 || vLines < 1) continue;
          if (doorLike && vLines < 2) continue;

          const support = countPoints(points, x, y, width, height);
          const perimeter = perimeterSupport(points, x, y, width, height);
          const interior = interiorStructure(points, x, y, width, height);
          if (support.count < 6) continue;
          if (perimeter.sides < 2) continue;
          if (!doorLike && interior.xBands < 2) continue;

          const score = Math.round(activeCells * 10 + borderActive * 7 + interiorActive * 4 + hLines * 9 + vLines * 9 + Math.min(18, support.strength / 1000));
          if (score < 48) continue;
          candidates.push({
            id: \`grid-fallback-\${id++}\`,
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2)),
            score,
            contributingLines: hLines + vLines,
            status: score >= 70 ? "high" : "low"
          });
        }
      }
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) => all.findIndex((other) => other.id !== candidate.id && overlaps(other, candidate) > 0.42 && other.score >= candidate.score) === -1)
    .slice(0, 6);
}

`;
  if (!s.includes(insertBefore)) throw new Error('detect function marker not found');
  s = s.replace(insertBefore, gridFn + insertBefore);
}

s = s.replace(
  'const candidates = [...componentCandidates(points, lines, surface), ...linePairCandidates(points, lines, surface)]',
  'const candidates = [...componentCandidates(points, lines, surface), ...linePairCandidates(points, lines, surface), ...edgeDensityGridCandidates(points, lines, surface)]'
);

fs.writeFileSync(p, s);
