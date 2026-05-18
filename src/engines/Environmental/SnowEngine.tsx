import { useEffect, useRef } from "react";
import { SnowFlake, settleDeposit, snowSurfacesFromZones, surfaceY, type SnowDeposit, type SnowZone } from "./snowPhysics";

export type SnowSettings = {
  density: number;
  speed: number;
  accumulation: number;
  wind: number;
};

export const defaultSnowSettings: SnowSettings = {
  density: 50,
  speed: 50,
  accumulation: 50,
  wind: 50
};

export function SnowEngine({ ledges, settings = defaultSnowSettings }: { ledges: SnowZone[]; settings?: SnowSettings }) {
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
    ctx.scale(dpr, dpr);

    const flakeCount = Math.max(40, Math.round(55 + settings.density * 4.4));
    const flakes = Array.from({ length: flakeCount }, () => new SnowFlake(rect.width));
    const surfaces = snowSurfacesFromZones(ledges, rect.width, rect.height);
    const deposits: SnowDeposit[] = [];
    const maxDeposits = Math.round(240 + settings.accumulation * 14);

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      flakes.forEach((flake) => {
        flake.update(rect.height, rect.width, settings);
        let landed = false;

        for (const surface of surfaces) {
          if (flake.x < surface.x1 || flake.x > surface.x2) continue;
          const y = surfaceY(surface, flake.x);
          if (!(flake.previousY <= y + 2 && flake.y >= y - 8) && Math.abs(flake.y - y) >= 8) continue;

          const accumulationFactor = 0.62 + settings.accumulation / 58;
          const r = flake.radius * accumulationFactor * (0.9 + Math.random() * 0.55);
          const settled = settleDeposit(flake.x, y - r * 0.35, r, deposits, surface.surfaceId, settings);
          const nearEdge = flake.x < surface.x1 + 12 || flake.x > surface.x2 - 12;
          const direction = surface.steep ? (surface.slope >= 0 ? 1 : -1) : (flake.x < (surface.x1 + surface.x2) / 2 ? -1 : 1);
          const overflowChance = Math.max(0.08, settings.accumulation / 210);
          const shouldDrop = surface.steep || (settled.crowded && nearEdge && Math.random() < overflowChance);

          deposits.push({
            x: settled.x,
            y: settled.y,
            r,
            opacity: 0.62 + Math.random() * 0.28,
            surfaceId: surface.surfaceId,
            vx: shouldDrop ? direction * (0.12 + settings.wind / 360 + Math.random() * 0.16) : 0,
            vy: shouldDrop ? 0.13 + settings.speed / 300 + Math.random() * 0.18 : 0
          });

          if (deposits.length > maxDeposits) deposits.splice(0, deposits.length - maxDeposits);
          flake.reset(rect.width);
          landed = true;
          break;
        }

        if (!landed) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      for (let i = deposits.length - 1; i >= 0; i -= 1) {
        const p = deposits[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.988;
        p.vy = p.vy ? Math.min(1.4, p.vy * 0.99 + 0.012) : 0;
        if (p.vy > 0.28) p.opacity *= 0.996;
        if (p.y > rect.height + 30 || p.opacity < 0.05) {
          deposits.splice(i, 1);
          continue;
        }

        const glow = p.r * 1.65;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
        g.addColorStop(0, "rgba(255,255,255," + p.opacity + ")");
        g.addColorStop(0.48, "rgba(255,255,255," + p.opacity * 0.7 + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [ledges, settings.density, settings.speed, settings.accumulation, settings.wind]);

  return <canvas ref={canvasRef} className="snowCanvasLayer" style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }} />;
}
