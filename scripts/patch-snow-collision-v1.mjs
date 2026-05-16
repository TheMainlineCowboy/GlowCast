import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const start = source.indexOf("interface SnowLedge {");
const end = source.indexOf("// --- SNOW ENGINE END ---", start);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("Could not locate snow engine block.");
}

const snowEngine = `interface SnowLedge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  slope: number;
  intercept: number;
  normalX: number;
  normalY: number;
  accumulation: number[];
  kind: "flat" | "curve" | "slope";
  maxAccumulation: number;
}

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

  reset(width: number) {
    this.y = Math.random() * -80 - 10;
    this.x = Math.random() * width;
    this.speed = Math.random() * 1 + 0.5;
    this.drift = Math.random() * 0.5 - 0.25;
  }

  update(height: number, width: number) {
    this.y += this.speed;
    this.x += this.drift;
    if (this.x < -12) this.x = width + 12;
    if (this.x > width + 12) this.x = -12;
    if (this.y > height) this.reset(width);
  }
}

function makeSnowLedge(
  x1Raw: number,
  y1: number,
  x2Raw: number,
  y2: number,
  kind: SnowLedge["kind"],
  maxAccumulation: number
): SnowLedge | null {
  const dx = x2Raw - x1Raw;
  const dy = y2 - y1;
  if (Math.abs(dx) < 0.001) return null;
  const xMin = Math.min(x1Raw, x2Raw);
  const xMax = Math.max(x1Raw, x2Raw);
  const slope = dy / dx;
  const intercept = y1 - slope * x1Raw;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    x1: xMin,
    y1,
    x2: xMax,
    y2,
    slope,
    intercept,
    normalX: -dy / len,
    normalY: dx / len,
    accumulation: new Array(Math.max(1, Math.ceil(xMax - xMin))).fill(0),
    kind,
    maxAccumulation
  };
}

function createLedgesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {
  const ledges: SnowLedge[] = [];
  const add = (ledge: SnowLedge | null) => { if (ledge) ledges.push(ledge); };

  zones.filter((zone) => zone.included).forEach((zone) => {
    const x = (zone.x / 100) * canvasWidth;
    const y = (zone.y / 100) * canvasHeight;
    const w = (zone.width / 100) * canvasWidth;
    const h = (zone.height / 100) * canvasHeight;
    const shape = zone.shape ?? "rectangle";

    if (shape === "rectangle") {
      add(makeSnowLedge(x, y, x + w, y, "flat", 18));
      return;
    }

    if (shape === "triangle") {
      const apex = { x: x + w / 2, y };
      const leftBase = { x, y: y + h };
      const rightBase = { x: x + w, y: y + h };
      add(makeSnowLedge(apex.x, apex.y, leftBase.x, leftBase.y, "slope", 4));
      add(makeSnowLedge(apex.x, apex.y, rightBase.x, rightBase.y, "slope", 4));
      return;
    }

    if (shape === "circle" || shape === "oval") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = shape === "circle" ? Math.min(w, h) / 2 : w / 2;
      const ry = shape === "circle" ? Math.min(w, h) / 2 : h / 2;
      const steps = 56;
      const points = Array.from({ length: steps + 1 }, (_, index) => {
        const angle = Math.PI + (Math.PI * index) / steps;
        return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
      }).filter((point) => point.y <= cy + 0.5);
      for (let index = 0; index < points.length - 1; index += 1) {
        const p1 = points[index];
        const p2 = points[index + 1];
        if (Math.abs((p2.y - p1.y) / Math.max(0.001, p2.x - p1.x)) > 3.5) continue;
        add(makeSnowLedge(p1.x, p1.y, p2.x, p2.y, "curve", 10));
      }
      return;
    }

    const points = zoneToGeometryPoints(zone, 48).map((point) => ({ x: (point.x / 100) * canvasWidth, y: (point.y / 100) * canvasHeight }));
    const topLimit = y + h * 0.58;
    for (let index = 0; index < points.length; index += 1) {
      const p1 = points[index];
      const p2 = points[(index + 1) % points.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      if (Math.abs(dx) < 0.001) continue;
      const slope = Math.abs(dy / dx);
      if (slope <= 1.5 && p1.y <= topLimit && p2.y <= topLimit) add(makeSnowLedge(p1.x, p1.y, p2.x, p2.y, slope > 0.35 ? "slope" : "curve", slope > 0.35 ? 5 : 10));
    }
  });

  return ledges;
}

function CanvasSnowLayer({ ledges }: { ledges: ProjectZone[] }) {
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

    const flakes = Array.from({ length: 280 }, () => new SnowFlake(rect.width));
    const activeLedges = createLedgesFromZones(ledges, rect.width, rect.height);

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      flakes.forEach((flake) => {
        flake.update(rect.height, rect.width);
        for (const ledge of activeLedges) {
          if (flake.x < ledge.x1 || flake.x > ledge.x2) continue;
          const surfaceY = ledge.slope * flake.x + ledge.intercept;
          const closeToSurface = flake.y >= surfaceY - 2 && flake.y <= surfaceY + Math.max(4, flake.speed + 3);
          if (!closeToSurface) continue;
          const index = Math.max(0, Math.min(ledge.accumulation.length - 1, Math.floor(flake.x - ledge.x1)));
          const gain = ledge.kind === "flat" ? 0.075 : ledge.kind === "curve" ? 0.045 : 0.018;
          const slideDirection = ledge.slope >= 0 ? 1 : -1;
          if (ledge.kind === "slope" && Math.abs(ledge.slope) > 0.25) {
            const slideIndex = Math.max(0, Math.min(ledge.accumulation.length - 1, index + Math.round(slideDirection * 5)));
            ledge.accumulation[slideIndex] = Math.min(ledge.maxAccumulation, ledge.accumulation[slideIndex] + gain);
          } else {
            ledge.accumulation[index] = Math.min(ledge.maxAccumulation, ledge.accumulation[index] + gain);
          }
          if (ledge.kind === "flat" && ledge.accumulation[index] > ledge.maxAccumulation * 0.86 && Math.random() < 0.018) {
            ledge.accumulation[index] = Math.max(0, ledge.accumulation[index] - Math.min(2.5, ledge.accumulation[index] * 0.18));
          }
          flake.reset(rect.width);
          break;
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      activeLedges.forEach((ledge) => {
        ctx.beginPath();
        ledge.accumulation.forEach((height, index) => {
          const px = ledge.x1 + index;
          const py = ledge.slope * px + ledge.intercept;
          const lift = height * (ledge.kind === "slope" ? 0.45 : 1);
          const ox = px + ledge.normalX * lift;
          const oy = py - Math.abs(ledge.normalY) * lift;
          if (index === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        });
        ctx.strokeStyle = ledge.kind === "slope" ? "rgba(255,255,255,.62)" : "rgba(255,255,255,.9)";
        ctx.lineWidth = ledge.kind === "slope" ? 2 : 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      });

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [ledges]);

  return <canvas ref={canvasRef} className="snowCanvasLayer" style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }} />;
}
`;

source = source.slice(0, start) + snowEngine + source.slice(end);
writeFileSync(path, source);
