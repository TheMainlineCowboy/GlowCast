import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");
const start = source.indexOf("// --- SNOW ENGINE START ---");
const end = source.indexOf("// --- SNOW ENGINE END ---", start);

if (start >= 0 && end > start) {
  const snowEngine = `// --- SNOW ENGINE START ---

type SnowSurfaceKind = "line" | "ellipse";

type SnowSurface = {
  kind: SnowSurfaceKind;
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

type SnowDeposit = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  surfaceId: number;
  vx: number;
  vy: number;
};

class SnowFlake {
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

  update(height: number, width: number) {
    this.previousY = this.y;
    this.y += this.speed;
    this.x += this.drift;
    if (this.y > height || this.x < -20 || this.x > width + 20) this.reset(width);
  }
}

function snowSurfacesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowSurface[] {
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

function surfaceY(surface: SnowSurface, x: number) {
  if (surface.kind === "ellipse" && surface.cx !== undefined && surface.cy !== undefined && surface.rx && surface.ry) {
    const n = Math.max(-1, Math.min(1, (x - surface.cx) / surface.rx));
    return surface.cy - surface.ry * Math.sqrt(Math.max(0, 1 - n * n));
  }
  return surface.slope * x + surface.intercept;
}

function settleDeposit(x: number, y: number, r: number, deposits: SnowDeposit[], surfaceId: number) {
  let sx = x;
  let sy = y;
  const neighbors = deposits.filter((p) => p.surfaceId === surfaceId).slice(-100);
  neighbors.forEach((p) => {
    const dx = sx - p.x;
    const dy = sy - p.y;
    const d = Math.max(0.01, Math.hypot(dx, dy));
    const min = (r + p.r) * 0.7;
    if (d < min) {
      const push = (min - d) * 0.34;
      sx += (dx >= 0 ? 1 : -1) * push;
      sy -= push * 0.17;
    }
  });
  return { x: sx, y: sy, crowded: neighbors.length > 65 };
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
    ctx.scale(dpr, dpr);

    const flakes = Array.from({ length: 275 }, () => new SnowFlake(rect.width));
    const surfaces = snowSurfacesFromZones(ledges, rect.width, rect.height);
    const deposits: SnowDeposit[] = [];
    const maxDeposits = 900;

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      flakes.forEach((flake) => {
        flake.update(rect.height, rect.width);
        let landed = false;

        for (const surface of surfaces) {
          if (flake.x < surface.x1 || flake.x > surface.x2) continue;
          const y = surfaceY(surface, flake.x);
          if (!(flake.previousY <= y + 2 && flake.y >= y - 8) && Math.abs(flake.y - y) >= 8) continue;

          const r = flake.radius * (1.25 + Math.random() * 0.75);
          const settled = settleDeposit(flake.x, y - r * 0.35, r, deposits, surface.surfaceId);
          const nearEdge = flake.x < surface.x1 + 12 || flake.x > surface.x2 - 12;
          const direction = surface.steep ? (surface.slope >= 0 ? 1 : -1) : (flake.x < (surface.x1 + surface.x2) / 2 ? -1 : 1);
          const shouldDrop = surface.steep || (settled.crowded && nearEdge && Math.random() < 0.42);
          deposits.push({
            x: settled.x,
            y: settled.y,
            r,
            opacity: 0.68 + Math.random() * 0.24,
            surfaceId: surface.surfaceId,
            vx: shouldDrop ? direction * (0.18 + Math.random() * 0.18) : 0,
            vy: shouldDrop ? 0.18 + Math.random() * 0.22 : 0
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
  }, [ledges]);

  return (
    <canvas
      ref={canvasRef}
      className="snowCanvasLayer"
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }}
    />
  );
}
// --- SNOW ENGINE END ---`;

  source = source.slice(0, start) + snowEngine + source.slice(end + "// --- SNOW ENGINE END ---".length);
}

writeFileSync(appPath, source);
