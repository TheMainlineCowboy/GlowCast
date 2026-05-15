import type { Zone } from "./detection";

export type GeometryPoint = {
  x: number;
  y: number;
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
