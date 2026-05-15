import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, FolderOpen, ImagePlus, MousePointer2, Pencil, Plus, Save, ScanLine, Trash2, Video } from "lucide-react";
import { detectSurfaceAndMasks, loadImage, type Zone } from "./detection"; 
import { warpImageToCanvas, type Point, type Quad } from "./homography";
import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect"; 

// --- STEP 1: SHAPE GEOMETRY ENGINE ---
export type GeometryPoint = { x: number; y: number };
export type GeometrySegment = { id: string; x1: number; y1: number; x2: number; y2: number };
export type GeometryShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";
export type GeometryZone = Zone & { shape?: GeometryShape; points?: GeometryPoint[] };

export function zoneToGeometryPoints(zone: GeometryZone, steps = 32): GeometryPoint[] {
  const { x, y, width: w, height: h } = zone;
  const shape = zone.shape ?? "rectangle";
  if (zone.points && zone.points.length >= 3) return zone.points;

  if (shape === "rectangle") return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  if (shape === "circle" || shape === "oval") {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = (shape === "circle" ? w / 2 : h / 2);
    return Array.from({ length: steps }, (_, i) => {
      const a = (Math.PI * 2 * i) / steps;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
  }
  if (shape === "triangle") return [{ x: x + w / 2, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  if (shape === "freehand") return [{ x: x + w * 0.1, y: y + h * 0.4 }, { x: x + w * 0.5, y: y + h * 0.1 }, { x: x + w * 0.9, y: y + h * 0.4 }, { x: x + w * 0.7, y: y + h * 0.9 }, { x: x + w * 0.3, y: y + h * 0.9 }];
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

export function zoneToGeometrySegments(zone: GeometryZone, steps = 32): GeometrySegment[] {
  const pts = zoneToGeometryPoints(zone, steps);
  const segments: GeometrySegment[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    segments.push({ id: `${zone.id}-${i}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }
  return segments;
}

export function getUpperFacingSegments(segments: GeometrySegment[], maxSlope = 1.35) {
  return segments.filter(s => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    return Math.abs(dx) > 0.001 && Math.abs(dy / dx) <= maxSlope;
  });
}

export function pointOnSegmentY(s: GeometrySegment, x: number) {
  const dx = s.x2 - s.x1;
  if (Math.abs(dx) < 0.001) return null;
  const t = (x - s.x1) / dx;
  return (t >= 0 && t <= 1) ? s.y1 + t * (s.y2 - s.y1) : null;
}

// --- SNOW ENGINE START ---
function CanvasSnowLayer({ zones }: { zones: ProjectZone[] }) { 
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const pileRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { 
    const canvas = canvasRef.current; if (!canvas) return; 
    const ctx = canvas.getContext("2d"); if (!ctx) return; 
    let animationFrame: number;

    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 150 }, () => ({ x: Math.random() * width, y: Math.random() * height, s: Math.random() * 2 + 1 }));

    const frame = () => {
      ctx.clearRect(0, 0, width, height);
      const rect = canvas.getBoundingClientRect();
      
      // Calculate ledges using Geometry Engine
      const ledgeList = zones.filter(z => z.included).flatMap(z => 
        getUpperFacingSegments(zoneToGeometrySegments(z, 36)).map(s => ({
          ...s, x1: (s.x1/100)*width, y1: (s.y1/100)*height, x2: (s.x2/100)*width, y2: (s.y2/100)*height
        }))
      );

      // Update/Draw Particles
      ctx.fillStyle = "white";
      particles.forEach(p => {
        p.y += p.s;
        if (p.y > height) { p.y = -10; p.x = Math.random() * width; }

        for (const ledge of ledgeList) {
          const lY = pointOnSegmentY(ledge, p.x);
          if (lY !== null && p.y >= lY - 2 && p.y <= lY + 5) {
            const cur = pileRef.current.get(ledge.id) ?? 0;
            pileRef.current.set(ledge.id, Math.min(12, cur + 0.05));
            p.y = -10; p.x = Math.random() * width;
            break;
          }
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
      });

      // Draw Piles
      ledgeList.forEach(ledge => {
        const pHeight = pileRef.current.get(ledge.id) ?? 0;
        if (pHeight <= 0) return;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = pHeight;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(ledge.x1, ledge.y1 - pHeight * 0.3); ctx.lineTo(ledge.x2, ledge.y2 - pHeight * 0.3); ctx.stroke();
      });

      animationFrame = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(animationFrame);
  }, [zones]); 

  return <canvas ref={canvasRef} className="snowCanvasLayer" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'none' }} />; 
} 
// --- SNOW ENGINE END ---

type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand"; 
type ProjectZone = Zone & { shape?: MaskShape; points?: Point[]; }; 
type EditTarget = "surface" | "zone";
type ResizeMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"; 
type ResizeAction = { target: EditTarget; id: number; mode: ResizeMode; startX: number; startY: number; original: ProjectZone; };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const num = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

function clampZonePositionOnly<T extends Pick<Zone, "x" | "y" | "width" | "height">>(zone: T): T { 
  const w = num(zone.width, 10), h = num(zone.height, 10); 
  return { ...zone, x: Number(clamp(zone.x, 0, 100 - w).toFixed(2)), y: Number(clamp(zone.y, 0, 100 - h).toFixed(2)), width: Number(w.toFixed(2)), height: Number(h.toFixed(2)) }; 
} 

function clampZone<T extends Pick<Zone, "x" | "y" | "width" | "height">>(zone: T): T {
  const w = clamp(num(zone.width, 10), 1, 100), h = clamp(num(zone.height, 10), 1, 100);
  return { ...zone, x: Number(clamp(zone.x, 0, 100 - w).toFixed(2)), y: Number(clamp(zone.y, 0, 100 - h).toFixed(2)), width: Number(w.toFixed(2)), height: Number(h.toFixed(2)) };
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [zones, setZones] = useState<ProjectZone[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<EditTarget>("surface");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);
  const [surfaceZone, setSurfaceZone] = useState<Zone | null>(null);

  function getPoint(event: React.PointerEvent) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const point = getPoint(event);
    if (!point || !resizeAction) return;
    
    const dx = point.x - resizeAction.startX;
    const dy = point.y - resizeAction.startY;
    let { x, y, width, height } = resizeAction.original;

    if (resizeAction.mode === "move") {
      x += dx; y += dy;
    } else {
      if (resizeAction.mode.includes("e")) width += dx;
      if (resizeAction.mode.includes("s")) height += dy;
      if (resizeAction.mode.includes("w")) { x += dx; width -= dx; }
      if (resizeAction.mode.includes("n")) { y += dy; height -= dy; }
    }

    const update = resizeAction.mode === "move" 
      ? clampZonePositionOnly({ x, y, width: resizeAction.original.width, height: resizeAction.original.height }) 
      : clampZone({ x, y, width, height }); 

    if (selectedTarget === "surface") setSurfaceZone(curr => curr ? ({ ...curr, ...update } as Zone) : null);
    else setZones(prev => prev.map(z => z.id === selectedZoneId ? { ...z, ...update } : z));
  }

  return (
    <div className="app-container h-screen w-screen bg-slate-900 flex flex-col text-white overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-8 bg-black/50 overflow-hidden" 
           onPointerMove={handlePointerMove} onPointerUp={() => setResizeAction(null)}>
        
        <div ref={surfaceRef} className="relative shadow-2xl transition-all duration-500 bg-slate-800" style={{ width: '80%', aspectRatio: '16/9' }}>
           {/* Snow Layer sits on top of masks */}
           <CanvasSnowLayer zones={zones} />
           
           {/* Mock Zones for demo */}
           {zones.map(zone => (
             <div key={zone.id} className={`absolute border-2 border-blue-400 ${zone.shape === 'circle' ? 'rounded-full' : ''}`}
                  style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }} />
           ))}
        </div>
      </div>
    </div>
  );
}
