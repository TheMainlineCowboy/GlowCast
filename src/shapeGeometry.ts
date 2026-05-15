import type { Zone } from "./detection";

export type GeometryPoint = {
  x: number;
  y: number;
};

export type GeometrySegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type GeometryZone = Zone & {
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
};

export function zoneToGeometryPoints(
  zone: GeometryZone,
  steps = 24
): GeometryPoint[] {
  const x = zone.x;
  const y = zone.y;
  const w = zone.width;
  const h = zone.height;
  const shape = zone.shape ?? "rectangle";

  if (shape === "rectangle") {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ];
  }

  if (shape === "triangle") {
    return [
      { x: x + w / 2, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ];
  }

  if (shape === "circle") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    return Array.from({ length: steps }, (_, i) => {
      const angle = (Math.PI * 2 * i) / steps;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      };
    });
  }

  if (shape === "oval") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;

    return Array.from({ length: steps }, (_, i) => {
      const angle = (Math.PI * 2 * i) / steps;
      return {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry
      };
    });
  }

  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
}

export function geometryPointsToSegments(
  idPrefix: string | number,
  points: GeometryPoint[],
  closed = true
): GeometrySegment[] {
  if (points.length < 2) return [];

  const segments: GeometrySegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      id: `${idPrefix}-${index}`,
      x1: points[index].x,
      y1: points[index].y,
      x2: points[index + 1].x,
      y2: points[index + 1].y
    });
  }

  if (closed && points.length >= 3) {
    const last = points[points.length - 1];
    const first = points[0];

    segments.push({
      id: `${idPrefix}-close`,
      x1: last.x,
      y1: last.y,
      x2: first.x,
      y2: first.y
    });
  }

  return segments;
}

export function zoneToGeometrySegments(
  zone: GeometryZone,
  steps = 32
): GeometrySegment[] {
  return geometryPointsToSegments(zone.id, zoneToGeometryPoints(zone, steps), true);
}

export function getTopLedgeSegments(
  zone: GeometryZone,
  steps = 32,
  maxSlope = 1.1
): GeometrySegment[] {
  const points = zoneToGeometryPoints(zone, steps);
  const segments = geometryPointsToSegments(zone.id, points, true);
  const topLimit = zone.y + zone.height * 0.58;

  return segments.filter((segment) => {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;

    if (Math.abs(dx) < 0.001) return false;

    const slope = Math.abs(dy / dx);
    const mostlyHorizontal = slope <= maxSlope;
    const inTopHalf = segment.y1 <= topLimit && segment.y2 <= topLimit;

    return mostlyHorizontal && inTopHalf;
  });
}

export function pointOnSegmentY(segment: GeometrySegment, x: number) {
  const dx = segment.x2 - segment.x1;

  if (Math.abs(dx) < 0.001) return null;

  const t = (x - segment.x1) / dx;

  if (t < 0 || t > 1) return null;

  return segment.y1 + t * (segment.y2 - segment.y1);
}
