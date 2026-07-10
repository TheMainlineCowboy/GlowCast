import type { EdgePoint } from "../edgeDetect";

export interface Point {
  x: number;
  y: number;
}

export interface CandidateZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
  confidence: number;
  label: string;
  points?: Point[];
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectorDiagnostics {
  components: number;
  rejectedSize: number;
  rejectedAspect: number;
  rejectedClosure: number;
  boundaryPenalized: number;
  rejectedConfidence: number;
  accepted: number;
  selected: number;
}

export interface DetectorOptions {
  gridResolution?: number;
  minDensityThreshold?: number;
  minSizePercent?: number;
  maxSizePercent?: number;
  bounds?: Bounds | null;
  polygon?: Point[] | null;
  onDiagnostics?: (diagnostics: DetectorDiagnostics) => void;
}

interface FrameCoverage {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  sidesPresent: number;
  scoreBoost: number;
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

function getOverlapRatio(a: CandidateZone, b: CandidateZone): number {
  const interX1 = Math.max(a.x, b.x);
  const interY1 = Math.max(a.y, b.y);
  const interX2 = Math.min(a.x + a.width, b.x + b.width);
  const interY2 = Math.min(a.y + a.height, b.y + b.height);

  if (interX2 <= interX1 || interY2 <= interY1) return 0;

  const interArea = (interX2 - interX1) * (interY2 - interY1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return interArea / Math.min(areaA, areaB);
}

function bridgeSmallBinaryGaps(binaryGrid: Uint8Array[], resolution: number): void {
  const bridgeTargets: Point[] = [];

  for (let y = 1; y < resolution - 1; y += 1) {
    for (let x = 1; x < resolution - 1; x += 1) {
      if (binaryGrid[y][x] === 1) continue;

      const horizontalBridge = binaryGrid[y][x - 1] === 1 && binaryGrid[y][x + 1] === 1;
      const verticalBridge = binaryGrid[y - 1][x] === 1 && binaryGrid[y + 1][x] === 1;
      const downDiagonalBridge = binaryGrid[y - 1][x - 1] === 1 && binaryGrid[y + 1][x + 1] === 1;
      const upDiagonalBridge = binaryGrid[y + 1][x - 1] === 1 && binaryGrid[y - 1][x + 1] === 1;

      if (horizontalBridge || verticalBridge || downDiagonalBridge || upDiagonalBridge) {
        bridgeTargets.push({ x, y });
      }
    }
  }

  for (const target of bridgeTargets) {
    binaryGrid[target.y][target.x] = 1;
  }
}

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

function getFrameCoverage(points: Point[], x: number, y: number, width: number, height: number): FrameCoverage {
  const tolerance = Math.max(1.0, Math.min(width, height) * 0.08);
  const minimumHits = Math.max(2, Math.ceil(points.length * 0.04));

  let topHits = 0;
  let rightHits = 0;
  let bottomHits = 0;
  let leftHits = 0;

  for (const point of points) {
    const insideHorizontalSpan = point.x >= x - tolerance && point.x <= x + width + tolerance;
    const insideVerticalSpan = point.y >= y - tolerance && point.y <= y + height + tolerance;

    if (insideHorizontalSpan && Math.abs(point.y - y) <= tolerance) topHits += 1;
    if (insideHorizontalSpan && Math.abs(point.y - (y + height)) <= tolerance) bottomHits += 1;
    if (insideVerticalSpan && Math.abs(point.x - x) <= tolerance) leftHits += 1;
    if (insideVerticalSpan && Math.abs(point.x - (x + width)) <= tolerance) rightHits += 1;
  }

  const top = topHits >= minimumHits;
  const right = rightHits >= minimumHits;
  const bottom = bottomHits >= minimumHits;
  const left = leftHits >= minimumHits;
  const sidesPresent = [top, right, bottom, left].filter(Boolean).length;

  return {
    top,
    right,
    bottom,
    left,
    sidesPresent,
    scoreBoost: Math.round((sidesPresent / 4) * 24)
  };
}

function collectComponents(
  binaryGrid: Uint8Array[],
  grid: Float32Array[],
  resolution: number
): Map<number, RawComponent> {
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

  function union(a: number, b: number): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootA] = rootB;
    }
  }

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (binaryGrid[y][x] !== 1) continue;

      const neighborLabels = [
        x > 0 && y > 0 ? labelGrid[y - 1][x - 1] : 0,
        y > 0 ? labelGrid[y - 1][x] : 0,
        x < resolution - 1 && y > 0 ? labelGrid[y - 1][x + 1] : 0,
        x > 0 ? labelGrid[y][x - 1] : 0
      ].filter((label) => label !== 0);

      if (neighborLabels.length === 0) {
        parent.push(currentLabel);
        labelGrid[y][x] = currentLabel;
        currentLabel += 1;
      } else {
        labelGrid[y][x] = neighborLabels[0];
        for (let i = 1; i < neighborLabels.length; i += 1) {
          union(neighborLabels[0], neighborLabels[i]);
        }
      }
    }
  }

  const componentsMap = new Map<number, RawComponent>();

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

      const leftStrength = x > 0 ? grid[y][x - 1] : 0;
      const rightStrength = x < resolution - 1 ? grid[y][x + 1] : 0;
      const topStrength = y > 0 ? grid[y - 1][x] : 0;
      const bottomStrength = y < resolution - 1 ? grid[y + 1][x] : 0;

      component.horizontalStrength += Math.abs(leftStrength - rightStrength);
      component.verticalStrength += Math.abs(topStrength - bottomStrength);
    }
  }

  return componentsMap;
}

export function detectArchitecturalCandidates(
  edgePoints: EdgePoint[],
  options: DetectorOptions = {}
): CandidateZone[] {
  if (!edgePoints || edgePoints.length === 0) {
    options.onDiagnostics?.({
      components: 0,
      rejectedSize: 0,
      rejectedAspect: 0,
      rejectedClosure: 0,
      boundaryPenalized: 0,
      rejectedConfidence: 0,
      accepted: 0,
      selected: 0
    });
    return [];
  }

  const resolution = options.gridResolution || 120;
  const minDensity = options.minDensityThreshold || 1;
  const minSize = options.minSizePercent || 1.5;
  const maxSize = options.maxSizePercent || 75.0;
  const detectorBounds = options.bounds ?? { x: 0, y: 0, width: 100, height: 100 };

  const grid: Float32Array[] = Array.from(
    { length: resolution },
    () => new Float32Array(resolution)
  );

  for (let i = 0; i < edgePoints.length; i += 1) {
    const pt = edgePoints[i];
    if (!isInsideDetectorScope(pt, options)) continue;

    const gx = Math.min(resolution - 1, Math.max(0, Math.floor((pt.x / 100) * resolution)));
    const gy = Math.min(resolution - 1, Math.max(0, Math.floor((pt.y / 100) * resolution)));
    grid[gy][gx] += pt.strength ?? 1.0;
  }

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

  bridgeSmallBinaryGaps(binaryGrid, resolution);
  closeThinArchitecturalGaps(binaryGrid, resolution);
  const componentsMap = collectComponents(binaryGrid, grid, resolution);

  const proposals: CandidateZone[] = [];
  const diagnostics: DetectorDiagnostics = {
    components: componentsMap.size,
    rejectedSize: 0,
    rejectedAspect: 0,
    rejectedClosure: 0,
    boundaryPenalized: 0,
    rejectedConfidence: 0,
    accepted: 0,
    selected: 0
  };
  let candidateIdCounter = 1;
  const timestamp = Date.now();

  componentsMap.forEach((component) => {
    const xPct = (component.minX / resolution) * 100;
    const yPct = (component.minY / resolution) * 100;
    const wPct = ((component.maxX - component.minX + 1) / resolution) * 100;
    const hPct = ((component.maxY - component.minY + 1) / resolution) * 100;

    if (wPct < minSize || hPct < minSize || wPct > maxSize || hPct > maxSize) {
      diagnostics.rejectedSize += 1;
      return;
    }

    const aspect = wPct / Math.max(hPct, 0.001);
    if (aspect > 6.0 || aspect < 0.15) {
      diagnostics.rejectedAspect += 1;
      return;
    }

    let score = 50;
    const totalStructural = component.horizontalStrength + component.verticalStrength;
    if (totalStructural > 0) {
      const balanceRatio =
        Math.min(component.horizontalStrength, component.verticalStrength) /
        Math.max(component.horizontalStrength, component.verticalStrength);
      score += Math.floor(balanceRatio * 20);
    }

    if (aspect >= 0.45 && aspect <= 1.2) {
      score += 15;
    } else if (aspect >= 0.3 && aspect < 0.45) {
      score += 10;
    }

    const frameCoverage = getFrameCoverage(component.points, xPct, yPct, wPct, hPct);
    // Detector candidates should be mostly closed architectural outlines.
    // Keep three-sided doorway/arch recovery while rejecting L/corner fragments.
    if (frameCoverage.sidesPresent < 3) {
      diagnostics.rejectedClosure += 1;
      return;
    }
    score += frameCoverage.scoreBoost;
    if (
      xPct <= detectorBounds.x + detectorBounds.width * 0.018 ||
      yPct <= detectorBounds.y + detectorBounds.height * 0.018 ||
      xPct + wPct >= detectorBounds.x + detectorBounds.width * 0.982 ||
      yPct + hPct >= detectorBounds.y + detectorBounds.height * 0.982
    ) {
      diagnostics.boundaryPenalized += 1;
      score -= 25;
    }

    score = Math.min(100, Math.max(0, score));
    if (score < 45) {
      diagnostics.rejectedConfidence += 1;
      return;
    }
    diagnostics.accepted += 1;

    let shapeLabel = "Obstacle";
    const outlinePoints = buildOutlinePoints(component.points);
    const calculatedShape: CandidateZone["shape"] = outlinePoints.length >= 5 ? "freehand" : "rectangle";
    const completeFramePrefix = frameCoverage.sidesPresent >= 3 ? "Complete " : "";

    if (score >= 70) {
      if (aspect >= 0.35 && aspect <= 0.6) {
        shapeLabel = calculatedShape === "freehand"
          ? `${completeFramePrefix}Door Outline`
          : `${completeFramePrefix}Door Candidate`;
      } else if (aspect >= 0.85 && aspect <= 1.15) {
        shapeLabel = calculatedShape === "freehand"
          ? `${completeFramePrefix}Window Outline`
          : `${completeFramePrefix}Window/Fixture`;
      } else {
        shapeLabel = calculatedShape === "freehand"
          ? `${completeFramePrefix}Structure Outline`
          : `${completeFramePrefix}Structure Candidate`;
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

  const rankedProposals = [...proposals].sort((a, b) => {
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return b.width * b.height - a.width * a.height;
  });

  const selected: CandidateZone[] = [];
  for (const candidate of rankedProposals) {
    const overlapsSelected = selected.some((existing) => getOverlapRatio(candidate, existing) > 0.82);
    if (!overlapsSelected) {
      selected.push(candidate);
    }
  }

  diagnostics.selected = selected.length;
  options.onDiagnostics?.({ ...diagnostics });
  return selected.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}
