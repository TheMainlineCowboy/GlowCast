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
  points?: Point[]; // Optional simplified outline points for custom/freehand masks.
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectorOptions {
  gridResolution?: number; // Size of the rasterized grid (e.g. 100x100)
  minDensityThreshold?: number; // Minimum edge points per grid cell to consider active
  minSizePercent?: number; // Minimum candidate size as percentage of space
  maxSizePercent?: number; // Maximum candidate size as percentage of space
  bounds?: Bounds | null; // Optional projection surface bounds in 0-100 coordinates
  polygon?: Point[] | null; // Optional closed projection surface polygon in 0-100 coordinates
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0001) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  );
  const projectedX = a.x + t * dx;
  const projectedY = a.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function buildConvexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points;

  const sorted = [...points]
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
    .filter((point, index, source) => {
      const previous = source[index - 1];
      return !previous || point.x !== previous.x || point.y !== previous.y;
    });

  if (sorted.length <= 3) return sorted;

  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function simplifyClosedPolygon(points: Point[], maxPoints = 12): Point[] {
  if (points.length <= maxPoints) return points;

  const simplified = [...points];
  while (simplified.length > maxPoints) {
    let weakestIndex = 0;
    let weakestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < simplified.length; i += 1) {
      const previous = simplified[(i - 1 + simplified.length) % simplified.length];
      const current = simplified[i];
      const next = simplified[(i + 1) % simplified.length];
      const distance = distanceToSegment(current, previous, next);

      if (distance < weakestDistance) {
        weakestDistance = distance;
        weakestIndex = i;
      }
    }

    simplified.splice(weakestIndex, 1);
  }

  return simplified;
}

function buildOutlinePoints(componentPoints: Point[]): Point[] {
  const hull = buildConvexHull(componentPoints);
  return simplifyClosedPolygon(hull, 12).map((point) => ({
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  }));
}

function isInsideDetectorScope(point: EdgePoint, options: DetectorOptions): boolean {
  const bounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };
  if (
    point.x < bounds.x ||
    point.x > bounds.x + bounds.width ||
    point.y < bounds.y ||
    point.y > bounds.y + bounds.height
  ) {
    return false;
  }

  const polygon = options.polygon && options.polygon.length >= 3 ? options.polygon : null;
  return polygon ? pointInPolygon(point, polygon) : true;
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
  const detectorBounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };

  // 2. Initialize spatial grid metrics.
  // Edge points are already normalized in 0-100 bounds.
  const grid: Float32Array[] = Array.from(
    { length: resolution },
    () => new Float32Array(resolution)
  );

  // Map normalized scatter points directly into spatial grid accumulation bins: O(N).
  for (let i = 0; i < edgePoints.length; i += 1) {
    const pt = edgePoints[i];
    if (!isInsideDetectorScope(pt, options)) continue;

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
    points: Point[];
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
          verticalStrength: 0,
          points: []
        });
      }

      const component = componentsMap.get(rootLabel)!;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      component.count += 1;
      component.points.push({
        x: ((x + 0.5) / resolution) * 100,
        y: ((y + 0.5) / resolution) * 100
      });

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

    // Signal C: boundary proximity penalty inside the selected projection surface.
    if (
      xPct <= detectorBounds.x + detectorBounds.width * 0.018 ||
      yPct <= detectorBounds.y + detectorBounds.height * 0.018 ||
      xPct + wPct >= detectorBounds.x + detectorBounds.width * 0.982 ||
      yPct + hPct >= detectorBounds.y + detectorBounds.height * 0.982
    ) {
      score -= 25;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < 45) return;

    let shapeLabel = "Obstacle";
    const outlinePoints = buildOutlinePoints(component.points);
    const calculatedShape: CandidateZone["shape"] = outlinePoints.length >= 5 ? "freehand" : "rectangle";

    if (score >= 70) {
      if (aspect >= 0.35 && aspect <= 0.6) {
        shapeLabel = calculatedShape === "freehand" ? "Door Outline" : "Door Candidate";
      } else if (aspect >= 0.85 && aspect <= 1.15) {
        shapeLabel = calculatedShape === "freehand" ? "Window Outline" : "Window/Fixture";
      } else {
        shapeLabel = calculatedShape === "freehand" ? "Structure Outline" : "Structure Candidate";
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
      label: `${shapeLabel} (${score}%)`,
      points: outlinePoints.length >= 3 ? outlinePoints : undefined
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
