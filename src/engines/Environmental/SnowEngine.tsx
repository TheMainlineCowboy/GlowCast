import { useEffect, useRef } from "react";

export type SnowMaskZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
};

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

    ctx.clearRect(0, 0, rect.width, rect.height);

    return () => undefined;
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
