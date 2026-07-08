import fs from 'node:fs';

const p = 'src/core/architecturalDetector.ts';
let s = fs.readFileSync(p, 'utf8');
let changed = false;

const helper = `
function closeThinArchitecturalGaps(binaryGrid: Uint8Array[], resolution: number, maxGap = 3): void {
  const bridgeTargets: Point[] = [];

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (binaryGrid[y][x] !== 1) continue;

      for (let gap = 1; gap <= maxGap; gap += 1) {
        const rightX = x + gap + 1;
        if (rightX < resolution && binaryGrid[y][rightX] === 1) {
          let clear = true;
          for (let fillX = x + 1; fillX < rightX; fillX += 1) {
            if (binaryGrid[y][fillX] !== 0) {
              clear = false;
              break;
            }
          }
          if (clear) {
            for (let fillX = x + 1; fillX < rightX; fillX += 1) bridgeTargets.push({ x: fillX, y });
          }
        }

        const downY = y + gap + 1;
        if (downY < resolution && binaryGrid[downY][x] === 1) {
          let clear = true;
          for (let fillY = y + 1; fillY < downY; fillY += 1) {
            if (binaryGrid[fillY][x] !== 0) {
              clear = false;
              break;
            }
          }
          if (clear) {
            for (let fillY = y + 1; fillY < downY; fillY += 1) bridgeTargets.push({ x, y: fillY });
          }
        }
      }
    }
  }

  for (const target of bridgeTargets) {
    binaryGrid[target.y][target.x] = 1;
  }
}
`;

if (!s.includes('function closeThinArchitecturalGaps(')) {
  const anchor = '\nfunction getFrameCoverage(points: Point[], x: number, y: number, width: number, height: number): FrameCoverage {';
  if (!s.includes(anchor)) throw new Error('Could not find getFrameCoverage anchor for thin gap helper.');
  s = s.replace(anchor, `${helper}${anchor}`);
  changed = true;
}

const oldCall = `  bridgeSmallBinaryGaps(binaryGrid, resolution);\n  const componentsMap = collectComponents(binaryGrid, grid, resolution);`;
const newCall = `  bridgeSmallBinaryGaps(binaryGrid, resolution);\n  closeThinArchitecturalGaps(binaryGrid, resolution);\n  const componentsMap = collectComponents(binaryGrid, grid, resolution);`;

if (s.includes(oldCall)) {
  s = s.replace(oldCall, newCall);
  changed = true;
}

if (!changed) {
  console.log('No changes made. Thin gap closing may already be applied.');
} else {
  fs.writeFileSync(p, s);
  console.log('Applied detector thin architectural gap closing patch.');
}
