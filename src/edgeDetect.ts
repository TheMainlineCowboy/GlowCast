export type EdgePoint = { x: number; y: number; strength?: number };

export type Coordinate = { x: number; y: number };

export type AutoMaskZone = {
  id: string;
  type: "auto-generated";
  shape: "polygon";
  points: Coordinate[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enabled: boolean;
};

interface ClusterGridCell {
  points: EdgePoint[];
  visited: boolean;
}

/**
 * Calculates the perpendicular distance from a point to a line segment.
 */
function getPerpendicularDistance(point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const denominator = Math.sqrt(dx * dx + dy * dy);
  return numerator / denominator;
}

/**
 * Simplifies a high-frequency array of coordinates using the Douglas-Peucker algorithm.
 */
export function simplifyPath(points: Coordinate[], tolerance: number): Coordinate[] {
  if (points.length <= 2) return points;
  
  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const distance = getPerpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  
  if (maxDistance > tolerance) {
    const results1 = simplifyPath(points.slice(0, index + 1), tolerance);
    const results2 = simplifyPath(points.slice(index), tolerance);
    return results1.slice(0, results1.length - 1).concat(results2);
  }
  
  return [points[0], points[end]];
}

/**
 * Automatically groups raw edges falling inside the projection target,
 * structuring them into bounded polygonal zones.
 *
 * @param edgePoints Source arrays from the scanImageEdges response
 * @param projectionZone Bounding matrix currently targeted on your canvas
 * @param options Calibration controls for grouping density and edge filtering
 */
export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: { x: number; y: number; width: number; height: number },
  options = { clusterRadius: 1.5, minPoints: 15, tolerance: 0.8 }
): AutoMaskZone[] {
  const containedPoints = edgePoints.filter((p) => {
    return (
      p.x >= projectionZone.x &&
      p.x <= projectionZone.x + projectionZone.width &&
      p.y >= projectionZone.y &&
      p.y <= projectionZone.y + projectionZone.height
    );
  });

  if (containedPoints.length === 0) return [];

  const cellSize = options.clusterRadius;
  const grid: Map<string, ClusterGridCell> = new Map();

  const getGridKey = (x: number, y: number) => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    return `${cx},${cy}`;
  };

  for (const p of containedPoints) {
    const key = getGridKey(p.x, p.y);
    if (!grid.has(key)) {
      grid.set(key, { points: [], visited: false });
    }
    grid.get(key)!.points.push(p);
  }

  const clusters: EdgePoint[][] = [];

  for (const [key, cell] of grid.entries()) {
    if (cell.visited || cell.points.length === 0) continue;

    const queue: string[] = [key];
    const currentCluster: EdgePoint[] = [];
    cell.visited = true;

    while (queue.length > 0) {
      const currentKey = queue.shift()!;
      const currentCell = grid.get(currentKey);
      if (!currentCell) continue;

      currentCluster.push(...currentCell.points);

      const [cx, cy] = currentKey.split(",").map(Number);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const neighborKey = `${cx + dx},${cy + dy}`;
          const neighborCell = grid.get(neighborKey);
          
          if (neighborCell && !neighborCell.visited && neighborCell.points.length > 0) {
            neighborCell.visited = true;
            queue.push(neighborKey);
          }
        }
      }
    }

    if (currentCluster.length >= options.minPoints) {
      clusters.push(currentCluster);
    }
  }

  const generatedZones: AutoMaskZone[] = [];

  for (const cluster of clusters) {
    let sumX = 0;
    let sumY = 0;
    for (const p of cluster) {
      sumX += p.x;
      sumY += p.y;
    }
    const center = { x: sumX / cluster.length, y: sumY / cluster.length };

    const sortedCoords: Coordinate[] = cluster
      .map((p) => ({ x: p.x, y: p.y }))
      .sort((a, b) => {
        const angleA = Math.atan2(a.y - center.y, a.x - center.x);
        const angleB = Math.atan2(b.y - center.y, b.x - center.x);
        return angleA - angleB;
      });

    if (sortedCoords.length > 0) {
      sortedCoords.push({ ...sortedCoords[0] });
    }

    const simplified = simplifyPath(sortedCoords, options.tolerance);

    if (simplified.length > 2) {
      simplified.pop();
    }

    if (simplified.length < 3) continue;

    const xs = simplified.map((p) => p.x);
    const ys = simplified.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    generatedZones.push({
      id: `auto_mask_${Math.random().toString(36).substr(2, 9)}`,
      type: "auto-generated",
      shape: "polygon",
      points: simplified,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      enabled: true,
    });
  }

  return generatedZones;
}

/**
 * Renders an inverted canvas context block, clipping out detected geometric
 * features while preserving output to the rest of the target projection area.
 */
export function drawProjectionWithMasks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  projectionZone: { x: number; y: number; width: number; height: number },
  masks: AutoMaskZone[],
  renderEffectCallback: () => void
): void {
  ctx.save();

  ctx.beginPath();
  ctx.rect(
    (projectionZone.x / 100) * width,
    (projectionZone.y / 100) * height,
    (projectionZone.width / 100) * width,
    (projectionZone.height / 100) * height
  );
  ctx.clip();

  for (const mask of masks) {
    if (!mask.enabled || mask.points.length < 3) continue;

    ctx.beginPath();
    ctx.rect(width, 0, -width, height);

    const firstPoint = mask.points[0];
    ctx.moveTo((firstPoint.x / 100) * width, (firstPoint.y / 100) * height);
    for (let i = 1; i < mask.points.length; i++) {
      ctx.lineTo((mask.points[i].x / 100) * width, (mask.points[i].y / 100) * height);
    }
    ctx.closePath();
    ctx.clip();
  }

  renderEffectCallback();

  ctx.restore();
}
