import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const start = source.indexOf("// --- SNOW ENGINE START ---");
const end = source.indexOf("// --- SNOW ENGINE END ---", start);

if (start >= 0 && end > start) {
  const snowEngine = `// --- SNOW ENGINE START ---

type SnowLedgeKind = "line" | "ellipse";

interface SnowLedge {
  kind: SnowLedgeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  slope: number;
  intercept: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  accumulation: number[];
}

class SnowFlake {
  x: number;
  y: number;
  previousY: number;
  radius: number;
  speed: number;
  drift: number;

  constructor(width: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * -100;
    this.previousY = this.y;
    this.radius = Math.random() * 2 + 1;
    this.speed = Math.random() * 1 + 0.5;
    this.drift = Math.random() * 0.5 - 0.25;
  }

  update(height: number, width: number) {
    this.previousY = this.y;
    this.y += this.speed;
    this.x += this.drift;
    if (this.y > height) {
      this.y = -10;
      this.previousY = this.y;
      this.x = Math.random() * width;
    }
  }
}

function createLedgesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {
  const ledges: SnowLedge[] = [];

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    if (Math.abs(dx) < 0.001) return;
    const xMin = Math.min(x1, x2);
    const xMax = Math.max(x1, x2);
    const slope = (y2 - y1) / dx;
    const intercept = y1 - slope * x1;
    ledges.push({
      kind: "line",
      x1: xMin,
      y1,
      x2: xMax,
      y2,
      slope,
      intercept,
      accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)
    });
  };

  zones.filter((zone) => zone.included).forEach((zone) => {
    const shape = zone.shape ?? "rectangle";
    const x = (zone.x / 100) * canvasWidth;
    const y = (zone.y / 100) * canvasHeight;
    const w = (zone.width / 100) * canvasWidth;
    const h = (zone.height / 100) * canvasHeight;

    if (shape === "circle" || shape === "oval") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, h / 2);
      ledges.push({
        kind: "ellipse",
        x1: cx - rx,
        y1: y,
        x2: cx + rx,
        y2: y,
        slope: 0,
        intercept: y,
        cx,
        cy,
        rx,
        ry,
        accumulation: new Array(Math.max(1, Math.floor(rx * 2))).fill(0)
      });
      return;
    }

    if (shape === "triangle") {
      addLine(x + w / 2, y, x + w, y + h);
      addLine(x, y + h, x + w / 2, y);
      return;
    }

    addLine(x, y, x + w, y);
  });

  return ledges;
}

function surfaceYAt(ledge: SnowLedge, x: number) {
  if (ledge.kind === "ellipse" && ledge.cx !== undefined && ledge.cy !== undefined && ledge.rx && ledge.ry) {
    const normalized = Math.max(-1, Math.min(1, (x - ledge.cx) / ledge.rx));
    return ledge.cy - ledge.ry * Math.sqrt(Math.max(0, 1 - normalized * normalized));
  }
  return ledge.slope * x + ledge.intercept;
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

    const flakes = Array.from({ length: 250 }, () => new SnowFlake(rect.width));
    const activeLedges = createLedgesFromZones(ledges, rect.width, rect.height);

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      flakes.forEach((flake) => {
        flake.update(rect.height, rect.width);

        activeLedges.forEach((ledge) => {
          if (flake.x < ledge.x1 || flake.x > ledge.x2) return;
          const surfaceY = surfaceYAt(ledge, flake.x);
          const crossed = flake.previousY <= surfaceY + 2 && flake.y >= surfaceY - 8;
          const close = Math.abs(flake.y - surfaceY) < 10;
          if (!crossed && !close) return;

          const idx = Math.floor(flake.x - ledge.x1);
          if (ledge.accumulation[idx] === undefined) return;
          ledge.accumulation[idx] = Math.min(20, ledge.accumulation[idx] + 0.12);
          flake.y = -10;
          flake.previousY = flake.y;
          flake.x = Math.random() * rect.width;
        });

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      activeLedges.forEach((ledge) => {
        ctx.beginPath();
        let started = false;
        ledge.accumulation.forEach((height, index) => {
          if (height <= 0.05) return;
          const px = ledge.x1 + index;
          const py = surfaceYAt(ledge, px);
          const oy = py - height;
          if (!started) {
            ctx.moveTo(px, oy);
            started = true;
          } else {
            ctx.lineTo(px, oy);
          }
        });
        ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
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
// --- SNOW ENGINE END ---`;

  source = source.slice(0, start) + snowEngine + source.slice(end + "// --- SNOW ENGINE END ---".length);
}

writeFileSync(appPath, source);
