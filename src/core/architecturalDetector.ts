import type { EdgePoint } from "../edgeDetect";

export interface Point {
  x: number;
  y: number;
}

export interface CandidateZone {
  id: string;
  x: number;      // 0-100 percentage relative to surface/canvas
  y: number;      // 0-100 percentage relative to surface/canvas
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
  shape: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
  confidence: number; // 0-100 score
  label: string;
}

export interface DetectorOptions {
  gridResolution?: number; // Size of the rasterized grid (e.g. 100x100)
  minDensityThreshold?: number; // Minimum edge points per grid cell to consider active
  minSizePercent?: number; // Minimum candidate size as percentage of space
  maxSizePercent?: number; // Maximum candidate size as percentage of space
}

/**
 * High-performance architectural detector engine.
 *
 * Implements a performance-safe O(N) grid-based connected component labeling
 * approach. Avoids O(N²) point clustering and enforces structural scoring to
 * reduce phantom templates, texture captures, and edge leaks.
 */
export function detectArchitecturalCandidates(
  edgePoints: EdgePoint[],
  options: DetectorOptions = {}
): CandidateZone[] {
  if (!edgePoints || edgePoints.length === 0) return [];

  // 1. Configuration baseline with conservative defaults.
  const resolution = options.gridResolution || 120;
  const minDensity = options.minDensityThreshold || 1;
  const minSize = options.minSizePercent || 1.5;
  const maxSize = options.maxSizePercent || 75.0;

  // 2. Initialize spatial grid metrics.
  // Edge points are already normalized in 0-100 bounds.
  const grid: Float32Array[] = Array.from(
    { length: resolution },
    () => new Float32Array(resolution)
  );

  // Map normalized scatter points directly into spatial grid accumulation bins: O(N).
  for (let i = 0; i < edgePoints.length; i += 1) {
    const pt = edgePoints[i];
    const gx = Math.min(resolution - 1, Math.max(0, Math.floor((pt.x / 100) * resolution)));
    const gy = Math.min(resolution - 1, Math.max(0, Math.floor((pt.y / 100) * resolution)));
    grid[gy][gx] += pt.strength ?? 1.0;
  }

  // 3. Binary segmentation grid with noise filtering.
  const binaryGrid: Uint8Array[] = Array.from(
    { length: resolution },
    () => new Uint8Array(resolution)
  );

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (grid[y][x] >= minDensity) {
        binaryGrid[y][x] = 1;
      }
    }
  }

  // 4. Two-pass connected component labeling: O(resolution²).
  const labelGrid: Int32Array[] = Array.from(
    { length: resolution },
    () => new Int32Array(resolution)
  );

  let currentLabel = 1;
  const parent: number[] = [0];

  function find(label: number): number {
    let root = label;
    while (parent[root] !== root) {
      root = parent[root];
    }

    let current = label;
    while (current !== root) {
      const next = parent[current];
      parent[current] = root;
      current = next;
    }

    return root;
  }

  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootA] = rootB;
    }
  }

  // Pass 1: local adjacency labeling.
  // This intentionally avoids large percent-distance flood clustering.
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (binaryGrid[y][x] !== 1) continue;

      const leftLabel = x > 0 ? labelGrid[y][x - 1] : 0;
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
      }
    }
  }

  interface RawComponent {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    count: number;
    horizontalStrength: number;
    verticalStrength: number;
  }

  const componentsMap = new Map<number, RawComponent>();

  // Pass 2: label flattening and metric compiling.
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (binaryGrid[y][x] !== 1) continue;

      const rootLabel = find(labelGrid[y][x]);
      labelGrid[y][x] = rootLabel;

      if (!componentsMap.has(rootLabel)) {
        componentsMap.set(rootLabel, {
          minX: x,
          maxX: x,
          minY: y,
          maxY: y,
          count: 0,
          horizontalStrength: 0,
          verticalStrength: 0
        });
      }

      const component = componentsMap.get(rootLabel)!;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      component.count += 1;

      // Local spatial alignment matrices.
      const leftStrength = x > 0 ? grid[y][x - 1] : 0;
      const rightStrength = x < resolution - 1 ? grid[y][x + 1] : 0;
      const topStrength = y > 0 ? grid[y - 1][x] : 0;
      const bottomStrength = y < resolution - 1 ? grid[y + 1][x] : 0;

      component.horizontalStrength += Math.abs(leftStrength - rightStrength);
      component.verticalStrength += Math.abs(topStrength - bottomStrength);
    }
  }

  // 5. Candidate validation and structural scoring.
  const proposals: CandidateZone[] = [];
  let candidateIdCounter = 1;
  const timestamp = Date.now();

  componentsMap.forEach((component) => {
    const xPct = (component.minX / resolution) * 100;
    const yPct = (component.minY / resolution) * 100;
    const wPct = ((component.maxX - component.minX + 1) / resolution) * 100;
    const hPct = ((component.maxY - component.minY + 1) / resolution) * 100;

    // Constraint 1: prevent micro noise or giant boundary fills.
    if (wPct < minSize || hPct < minSize) return;
    if (wPct > maxSize || hPct > maxSize) return;

    const aspect = wPct / Math.max(hPct, 0.001);

    // Reject long horizontal/vertical lines: siding artifacts, baseboards, shadows.
    if (aspect > 6.0 || aspect < 0.15) return;

    let score = 50;

    // Signal A: structural balance between directional responses.
    const totalStructural = component.horizontalStrength + component.verticalStrength;
    if (totalStructural > 0) {
      const balanceRatio =
        Math.min(component.horizontalStrength, component.verticalStrength) /
        Math.max(component.horizontalStrength, component.verticalStrength);
      score += Math.floor(balanceRatio * 20);
    }

    // Signal B: architectural aspect matching.
    if (aspect >= 0.45 && aspect <= 1.2) {
      score += 15;
    } else if (aspect >= 0.3 && aspect < 0.45) {
      score += 10;
    }

    // Signal C: boundary proximity penalty.
    if (xPct <= 1.5 || yPct <= 1.5 || xPct + wPct >= 98.5 || yPct + hPct >= 98.5) {
      score -= 25;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < 45) return;

    let shapeLabel = "Obstacle";
    const calculatedShape: CandidateZone["shape"] = "rectangle";

    if (score >= 70) {
      if (aspect >= 0.35 && aspect <= 0.6) {
        shapeLabel = "Door Candidate";
      } else if (aspect >= 0.85 && aspect <= 1.15) {
        shapeLabel = "Window/Fixture";
      } else {
        shapeLabel = "Structure Candidate";
      }
    }

    proposals.push({
      id: `candidate_${timestamp}_${candidateIdCounter++}`,
      x: Number(xPct.toFixed(2)),
      y: Number(yPct.toFixed(2)),
      width: Number(wPct.toFixed(2)),
      height: Number(hPct.toFixed(2)),
      shape: calculatedShape,
      confidence: score,
      label: `${shapeLabel} (${score}%)`
    });
  });

  // 6. Proximity-based duplicate overlap removal.
  return proposals.filter((candidate, index) => {
    for (let i = 0; i < index; i += 1) {
      const existing = proposals[i];
      const interX1 = Math.max(candidate.x, existing.x);
      const interY1 = Math.max(candidate.y, existing.y);
      const interX2 = Math.min(candidate.x + candidate.width, existing.x + existing.width);
      const interY2 = Math.min(candidate.y + candidate.height, existing.y + existing.height);

      if (interX2 > interX1 && interY2 > interY1) {
        const interArea = (interX2 - interX1) * (interY2 - interY1);
        const areaA = candidate.width * candidate.height;
        const areaB = existing.width * existing.height;
        const overlapRatio = interArea / Math.min(areaA, areaB);

        if (overlapRatio > 0.82) {
          return candidate.confidence > existing.confidence;
        }
      }
    }
    return true;
  });
}
