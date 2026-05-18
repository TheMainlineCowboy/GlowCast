import { useEffect, useRef } from "react";

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

type SnowZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
};

export function SnowEngine({ ledges, settings = defaultSnowSettings }: { ledges: SnowZone[]; settings?: SnowSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let frameId = 0;
    const flakes = Array.from({ length: Math.max(40, Math.round(55 + settings.density * 4.4)) }, () => ({
      x: Math.random() * rect.width,
      y: -Math.random() * rect.height,
      r: 1 + Math.random() * 2,
      s: 0.65 + Math.random() * 1.25,
      d: Math.random() * 0.7 - 0.35
    }));

    const tick = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "rgba(255,255,255,.78)";
      const speed = 0.35 + settings.speed / 42;
      const wind = (settings.wind - 50) / 42;
      flakes.forEach((flake) => {
        flake.y += flake.s * speed;
        flake.x += flake.d + wind;
        if (flake.y > rect.height || flake.x < -30 || flake.x > rect.width + 30) {
          flake.x = Math.random() * rect.width;
          flake.y = -20 - Math.random() * 100;
        }
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frameId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [ledges, settings.density, settings.speed, settings.accumulation, settings.wind]);

  return <canvas ref={canvasRef} className="snowCanvasLayer" style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }} />;
}
