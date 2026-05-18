import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

source = source.replace(
  `class SnowFlake {
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
}`,
  `class SnowFlake {
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
}`
);

const start = source.indexOf("function createLedgesFromZones(");
const end = source.indexOf("function CanvasSnowLayer(", start);

if (start >= 0 && end > start) {
  const replacement = `function createLedgesFromZones(zones: ProjectZone[], canvasWidth: number, canvasHeight: number): SnowLedge[] {
  const ledges: SnowLedge[] = [];

  const addLedge = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 0.001) return;

    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    const slope = dy / dx;
    const intercept = a.y - slope * a.x;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    ledges.push({
      x1: xMin,
      y1: a.y,
      x2: xMax,
      y2: b.y,
      slope,
      intercept,
      normalX: -dy / len,
      normalY: Math.abs(dx / len),
      accumulation: new Array(Math.max(1, Math.floor(xMax - xMin))).fill(0)
    });
  };

  zones.filter((zone) => zone.included).forEach((zone) => {
    const shape = zone.shape ?? "rectangle";
    const isRound = shape === "circle" || shape === "oval";
    const steps = isRound ? 384 : shape === "freehand" ? 128 : 8;
    const points = zoneToGeometryPoints(zone, steps).map((point) => ({
      x: (point.x / 100) * canvasWidth,
      y: (point.y / 100) * canvasHeight
    }));
    if (points.length < 2) return;

    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const height = Math.max(1, maxY - minY);
    const cutoff = shape === "rectangle" ? minY + 1 : minY + height * (isRound ? 0.74 : 0.62);

    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const middleY = (current.y + next.y) / 2;
      if (Math.abs(dx) < 0.001) continue;
      if (!isRound && Math.abs(dy / dx) > 4.5) continue;
      if (middleY > cutoff) continue;
      addLedge(current, next);
    }
  });

  return ledges;
}

`;

  source = source.slice(0, start) + replacement + source.slice(end);
}

source = source.replace(
  `    const activeLedges = createLedgesFromZones(ledges, rect.width, rect.height);

    const drawShapeSnowRidges = () => {
      ledges.filter((zone) => zone.included).forEach((zone) => {
        const shape = zone.shape ?? "rectangle";
        if (shape === "rectangle") return;
        const x = (zone.x / 100) * rect.width;
        const y = (zone.y / 100) * rect.height;
        const w = (zone.width / 100) * rect.width;
        const h = (zone.height / 100) * rect.height;
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        if (shape === "circle" || shape === "oval") {
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 1.04, Math.PI * 1.96);
        } else if (shape === "triangle") {
          ctx.moveTo(cx, y + 2);
          ctx.lineTo(x + w - 3, y + h - 2);
          ctx.moveTo(cx, y + 2);
          ctx.lineTo(x + 3, y + h - 2);
        } else {
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 1.08, Math.PI * 1.92);
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      });
    };`,
  `    const activeLedges = createLedgesFromZones(ledges, rect.width, rect.height);`
);

source = source.replace(
  `            const dist = Math.abs(f.y - surfaceY);

            if (dist < 3) {`,
  `            const crossedSurface = f.previousY <= surfaceY + 2 && f.y >= surfaceY - 7;
            const dist = Math.abs(f.y - surfaceY);

            if (crossedSurface || dist < 10) {`
);

source = source.replace(
  `                l.accumulation[idx] = Math.min(15, l.accumulation[idx] + 0.05);`,
  `                l.accumulation[idx] = Math.min(18, l.accumulation[idx] + 0.08);`
);

source = source.replace(
  `                l.accumulation[idx] = Math.min(24, l.accumulation[idx] + 0.18);`,
  `                l.accumulation[idx] = Math.min(18, l.accumulation[idx] + 0.08);`
);

source = source.replace(
  `        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
        ctx.lineWidth = 3;
        ctx.stroke();`,
  `        ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();`
);

source = source.replace(
  `        ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = 4;
        ctx.stroke();`,
  `        ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();`
);

source = source.replace(
  `      drawShapeSnowRidges();
      frameId = requestAnimationFrame(render);`,
  `      frameId = requestAnimationFrame(render);`
);

writeFileSync(appPath, source);
