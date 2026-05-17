import { useEffect, useRef } from "react";
import { zoneToGeometryPoints } from "../../core/geometry";

export type SnowMaskZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
  label?: string;
};

type SnowLedge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  slope: number;
  intercept: number;
  normalX: number;
  normalY: number;
  accumulation: number[];
};

class SnowFlake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;

  constructor(width: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * -100;
    this.radius = Math.random() * 2 + 1;
    this.speed = Math.random() * 1 + 0.5;
    this.drift = Math.random() * 0.5 - 0.25;
  }

  update(height: number, width: number) {
    this.y += this.speed;
    this.x += this.drift;
    if (this.y > height) {
      this.y = -10;
      this.x = Math.random() * width;
    }
  }
}

function createLedgesFromZones(zones: SnowMaskZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {
  const ledges: SnowLedge[] = [];

  zones.filter((zone) => zone.included).forEach((zone) => {
    const points = zoneToGeometryPoints(zone).map((point) => ({
      x: (point.x / 100) * canvasWidth,
      y: (point.y / 100) * canvasHeight
    }));

    for (let index = 0; index < points.length; index += 1) {
      const p1 = points[index];
      const p2 = points[(index + 1) % points.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      if (Math.abs(dx) > 0.001 && Math.abs(dy / dx) < 1.4) {
        const xMin = Math.min(p1.x, p2.x);
        const xMax = Math.max(p1.x, p2.x);
        const slope = dy / dx;
        const intercept = p1.y - slope * p1.x;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));

        ledges.push({
          x1: xMin,
          y1: p1.y,
          x2: xMax,
          y2: p2.y,
          slope,
          intercept,
          normalX: -dy / len,
          normalY: dx / len,
          accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)
        });
      }
    }
  });

  return ledges;
}

export function CanvasSnowLayer({ ledges }: { ledges: SnowMaskZone[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const flakes = Array.from({ length: 250 }, () => new SnowFlake(rect.width));
    const activeLedges = createLedgesFromZones(ledges, rect.width, rect.height);

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      flakes.forEach((flake) => {
        flake.update(rect.height, rect.width);

        activeLedges.forEach((ledge) => {
          if (flake.x >= ledge.x1 && flake.x <= ledge.x2) {
            const surfaceY = ledge.slope * flake.x + ledge.intercept;
            const dist = Math.abs(flake.y - surfaceY);

            if (dist < 3) {
              const accumulationIndex = Math.floor(flake.x - ledge.x1);
              if (ledge.accumulation[accumulationIndex] !== undefined) {
                ledge.accumulation[accumulationIndex] = Math.min(15, ledge.accumulation[accumulationIndex] + 0.05);
                flake.y = -10;
                flake.x = Math.random() * rect.width;
              }
            }
          }
        });

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      activeLedges.forEach((ledge) => {
        ctx.beginPath();
        ledge.accumulation.forEach((height, index) => {
          const px = ledge.x1 + index;
          const py = ledge.slope * px + ledge.intercept;
          const ox = px + ledge.normalX * height;
          const oy = py - ledge.normalY * height;

          if (index === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        });

        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [ledges]);

  return (
    <canvas
      ref={canvasRef}
      className="snowCanvasLayer"
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 10,
        pointerEvents: "none"
      }}
    />
  );
}
