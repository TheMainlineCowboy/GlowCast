import type { SnowSettings } from "./SnowEngine";

export type SnowZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
};

export type SnowSurface = {
  kind: "line" | "ellipse";
  surfaceId: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  slope: number;
  intercept: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  steep?: boolean;
};

export type SnowDeposit = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  surfaceId: number;
  vx: number;
  vy: number;
};

export class SnowFlake {
  x: number;
  y: number;
  previousY: number;
  radius: number;
  speed: number;
  drift: number;

  constructor(width: number) {
    this.x = Math.random() * width;
    this.y = -10 - Math.random() * 100;
    this.previousY = this.y;
    this.radius = 1 + Math.random() * 2;
    this.speed = 0.65 + Math.random() * 1.25;
    this.drift = Math.random() * 0.7 - 0.35;
  }

  reset(width: number) {
    this.x = Math.random() * width;
    this.y = -10 - Math.random() * 100;
    this.previousY = this.y;
    this.radius = 1 + Math.random() * 2;
    this.speed = 0.65 + Math.random() * 1.25;
    this.drift = Math.random() * 0.7 - 0.35;
  }

  update(height: number, width: number, settings: SnowSettings) {
    this.previousY = this.y;
    const speedFactor = 0.35 + settings.speed / 42;
    const windPush = (settings.wind - 50) / 42;
    this.y += this.speed * speedFactor;
    this.x += this.drift + windPush;
    if (this.y > height || this.x < -30 || this.x > width + 30) this.reset(width);
  }
}

export function snowSurfacesFromZones(zones: SnowZone[], canvasWidth: number, canvasHeight: number): SnowSurface[] {
  const surfaces: SnowSurface[] = [];
  const addLine = (zoneId: number, x1: number, y1: number, x2: number, y2: number, steep = false) => {
    const dx = x2 - x1;
    if (Math.abs(dx) < 0.001) return;
    const slope = (y2 - y1) / dx;
    const intercept = y1 - slope * x1;
    surfaces.push({ kind: "line", surfaceId: zoneId, x1: Math.min(x1, x2), x2: Math.max(x1, x2), y1, y2, slope, intercept, steep });
  };

  zones.filter((zone) => zone.included).forEach((zone) => {
    const shape = zone.shape ?? "rectangle";
    const x = zone.x / 100 * canvasWidth;
    const y = zone.y / 100 * canvasHeight;
    const w = zone.width / 100 * canvasWidth;
    const h = zone.height / 100 * canvasHeight;

    if (shape === "circle" || shape === "oval") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, h / 2);
      surfaces.push({ kind: "ellipse", surfaceId: zone.id, x1: cx - rx, x2: cx + rx, y1: y, y2: y, slope: 0, intercept: y, cx, cy, rx, ry });
      return;
    }

    if (shape === "triangle") {
      addLine(zone.id, x + w / 2, y, x + w, y + h, true);
      addLine(zone.id, x, y + h, x + w / 2, y, true);
      return;
    }

    addLine(zone.id, x, y, x + w, y);
  });
  return surfaces;
}

export function surfaceY(surface: SnowSurface, x: number) {
  if (surface.kind === "ellipse" && surface.cx !== undefined && surface.cy !== undefined && surface.rx && surface.ry) {
    const n = Math.max(-1, Math.min(1, (x - surface.cx) / surface.rx));
    return surface.cy - surface.ry * Math.sqrt(Math.max(0, 1 - n * n));
  }
  return surface.slope * x + surface.intercept;
}

export function settleDeposit(x: number, y: number, r: number, deposits: SnowDeposit[], surfaceId: number, settings: SnowSettings) {
  let sx = x;
  let sy = y;
  const neighbors = deposits.filter((p) => p.surfaceId === surfaceId).slice(-100);
  neighbors.forEach((p) => {
    const dx = sx - p.x;
    const dy = sy - p.y;
    const d = Math.max(0.01, Math.hypot(dx, dy));
    const min = (r + p.r) * (0.52 + settings.accumulation / 280);
    if (d < min) {
      const push = (min - d) * (0.22 + settings.accumulation / 420);
      sx += (dx >= 0 ? 1 : -1) * push;
      sy -= push * 0.17;
    }
  });
  return { x: sx, y: sy, crowded: neighbors.length > Math.max(35, 95 - settings.accumulation) };
}
