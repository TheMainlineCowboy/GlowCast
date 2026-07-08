import fs from 'node:fs';

const p = 'src/core/architecturalDetector.ts';
let s = fs.readFileSync(p, 'utf8');
let changed = false;

const oldBridge = `      const horizontalBridge = binaryGrid[y][x - 1] === 1 && binaryGrid[y][x + 1] === 1;
      const verticalBridge = binaryGrid[y - 1][x] === 1 && binaryGrid[y + 1][x] === 1;

      if (horizontalBridge || verticalBridge) {
        bridgeTargets.push({ x, y });
      }`;

const newBridge = `      const horizontalBridge = binaryGrid[y][x - 1] === 1 && binaryGrid[y][x + 1] === 1;
      const verticalBridge = binaryGrid[y - 1][x] === 1 && binaryGrid[y + 1][x] === 1;
      const downDiagonalBridge = binaryGrid[y - 1][x - 1] === 1 && binaryGrid[y + 1][x + 1] === 1;
      const upDiagonalBridge = binaryGrid[y + 1][x - 1] === 1 && binaryGrid[y - 1][x + 1] === 1;

      if (horizontalBridge || verticalBridge || downDiagonalBridge || upDiagonalBridge) {
        bridgeTargets.push({ x, y });
      }`;

if (s.includes(oldBridge)) {
  s = s.replace(oldBridge, newBridge);
  changed = true;
}

const oldLabeling = `      const leftLabel = x > 0 ? labelGrid[y][x - 1] : 0;
      const topLabel = y > 0 ? labelGrid[y - 1][x] : 0;

      if (leftLabel === 0 && topLabel === 0) {
        parent.push(currentLabel);
        labelGrid[y][x] = currentLabel;
        currentLabel += 1;
      } else if (leftLabel !== 0 && topLabel === 0) {
        labelGrid[y][x] = leftLabel;
      } else if (leftLabel === 0 && topLabel !== 0) {
        labelGrid[y][x] = topLabel;
      } else {
        labelGrid[y][x] = leftLabel;
        union(leftLabel, topLabel);
      }`;

const newLabeling = `      const neighborLabels = [
        x > 0 ? labelGrid[y][x - 1] : 0,
        y > 0 ? labelGrid[y - 1][x] : 0,
        x > 0 && y > 0 ? labelGrid[y - 1][x - 1] : 0,
        x < resolution - 1 && y > 0 ? labelGrid[y - 1][x + 1] : 0
      ].filter((label) => label !== 0);

      if (neighborLabels.length === 0) {
        parent.push(currentLabel);
        labelGrid[y][x] = currentLabel;
        currentLabel += 1;
      } else {
        const primaryLabel = neighborLabels[0];
        labelGrid[y][x] = primaryLabel;
        for (let i = 1; i < neighborLabels.length; i += 1) {
          union(primaryLabel, neighborLabels[i]);
        }
      }`;

if (s.includes(oldLabeling)) {
  s = s.replace(oldLabeling, newLabeling);
  changed = true;
}

if (!changed) {
  console.log('No changes made. Patch may already be applied or source shape changed.');
} else {
  fs.writeFileSync(p, s);
  console.log('Applied detector diagonal connectivity patch.');
}
