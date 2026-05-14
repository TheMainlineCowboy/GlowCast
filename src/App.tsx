import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  ImagePlus,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  ScanLine,
  Trash2,
  Video
} from "lucide-react";
import { detectSurfaceAndMasks, loadImage, type Zone } from "./detection";
import { warpImageToCanvas, type Point, type Quad } from "./homography";
import { scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";

type Effect = { id: string; name: string; description: string; };
type MaskShape = "rectangle" | "oval" | "triangle" | "freehand";
type ProjectZone = Zone & { shape?: MaskShape };
type DraftZone = { startX: number; startY: number; currentX: number; currentY: number; shape: MaskShape; };
type ImageSize = { width: number; height: number };
type ProjectionContent = "effect" | "video";
type Step = "start" | "mask" | "content" | "export";
type ResizeMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type EditTarget = "surface" | "zone";

type ResizeAction = {
  target: EditTarget;
  id: number;
  mode: ResizeMode;
  startX: number;
  startY: number;
  original: ProjectZone;
};

type SavedProject = {
  id: string;
  name: string;
  savedAt: string;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  imageSize: ImageSize;
  surfaceZone: Zone | null;
  zones: ProjectZone[];
  activeEffect: string;
  invertMode: boolean;
  projectionContent: ProjectionContent;
  videoUrl: string | null;
};

type RecentPhoto = {
  id: string;
  name: string;
  usedAt: string;
  imageUrl: string;
  thumbnailUrl: string;
  imageSize: ImageSize;
};

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow" },
  { id: "rain", name: "Rainfall", description: "Soft rain streaks" },
  { id: "neon", name: "Neon Glow", description: "Electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

const shapeOptions: { id: MaskShape; name: string }[] = [
  { id: "rectangle", name: "Rectangle" },
  { id: "oval", name: "Circle / Oval" },
  { id: "triangle", name: "Triangle" }
];

const handles: ResizeMode[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const RECENT_PROJECTS_KEY = "glowcast-recent-projects";
const RECENT_PHOTOS_KEY = "glowcast-recent-photos";
const SAFE = 1.6;
const cornerNames = ["top-left", "top-right", "bottom-right", "bottom-left"];

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const num = (v: number, fallback: number) => Number.isFinite(v) ? v : fallback;

const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({
  left: `${zone.x}%`,
  top: `${zone.y}%`,
  width: `${zone.width}%`,
  height: `${zone.height}%`
});

const defaultSurface = (): Zone => ({
  id: -1, x: 8, y: 14, width: 84, height: 72, included: true, label: "projection surface"
});

function clampZone<T extends Pick<Zone, "x" | "y" | "width" | "height">>(zone: T): T {
  const width = clamp(num(zone.width, 10), 2, 100 - SAFE * 2);
  const height = clamp(num(zone.height, 10), 2, 100 - SAFE * 2);
  return {
    ...zone,
    x: Number(clamp(num(zone.x, 0), SAFE, 100 - width - SAFE).toFixed(2)),
    y: Number(clamp(num(zone.y, 0), SAFE, 100 - height - SAFE).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2))
  };
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 16, height: 9 });
  const [surfaceZone, setSurfaceZone] = useState<Zone | null>(null);
  const [zones, setZones] = useState<ProjectZone[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<EditTarget>("surface");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [drawShape, setDrawShape] = useState<MaskShape>("rectangle");
  const [activeEffect, setActiveEffect] = useState("snow");
  const [projectionContent, setProjectionContent] = useState<ProjectionContent>("effect");
  const [invertMode, setInvertMode] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [projectionOnly, setProjectionOnly] = useState(false);
  const [projectorMode, setProjectorMode] = useState(false);
  const [cornerMode, setCornerMode] = useState(false);
  const [cornerPoints, setCornerPoints] = useState<Point[]>([]);
  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true); // Patch B
  
  // Edge Scanner State
  const [showEdges, setShowEdges] = useState(false);
  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const projectionArea = surfaceZone ?? defaultSurface();
  const hasProject = Boolean(imageUrl || surfaceZone || zones.length);

  // Patch D: Gravity Well Snapping
  function getPoint(event: React.PointerEvent<HTMLElement>, allowSnap = true) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    const rawPoint = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100)
    };
    if (!allowSnap || !snapEnabled || !showEdges || !edgePoints.length) return rawPoint;
    return snapPointToEdge(rawPoint, edgePoints);
  }

  // Patch A: Aspect Ratio calculation
  async function finishCornerCalibration(points: Quad) {
    if (!imageUrl) return;
    const image = await loadImage(imageUrl);
    
    // Calculate "True" width/height averages for aspect ratio
    const topDist = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const bottomDist = Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y);
    const leftDist = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
    const rightDist = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
    
    const avgW = (topDist + bottomDist) / 2;
    const avgH = (leftDist + rightDist) / 2;
    const canvas = warpImageToCanvas(image, points, 1600, 1600 * (avgH / avgW));
    
    setImageUrl(canvas.toDataURL("image/jpeg", 0.92));
    setImageSize({ width: 1600, height: 1600 * (avgH / avgW) });
    setSurfaceZone({ id: -1, x: 0, y: 0, width: 100, height: 100, included: true, label: "flattened" });
    setShowSurfaceHandles(false); // Patch B: Hide handles after flattening
    setCornerMode(false);
    setStep("mask");
  }

  // Implementation of standard UI/logic omitted for brevity...
  return (
    <main className="appShell">
      {/* Patch C: Cleanup - Removed "Paid AI Detect" button and warning text */}
      <section className="workspace">
         <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Surface + Masks</h2>
              <button className="primary" onClick={() => setCornerMode(true)}>Set Wall Corners</button>
              
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
                Magnetic snap (10px Gravity Well)
              </label>

              <div className="shapeToolRow">
                {shapeOptions.map(shape => (
                  <button key={shape.id} onClick={() => { setDrawShape(shape.id); setDrawMode(true); }}>
                    {shape.name}
                  </button>
                ))}
              </div>
            </div>
         </aside>

         <section className="stageWrap">
           <div ref={surfaceRef} className="surfaceLayer">
             {imageUrl && <img src={imageUrl} className="referencePhoto" alt="setup" />}
             
             {/* Only show surface boundary if explicitly enabled (Patch B) */}
             {!projectionOnly && showSurfaceHandles && (
                <div className="projectionBoundary" style={toStyle(projectionArea)}>
                  <b>surface</b>
                </div>
             )}

             {zones.map((zone) => (
                <div key={zone.id} className="zone" style={toStyle(zone)}>
                  <span>mask</span>
                </div>
             ))}
           </div>
         </section>
      </section>
    </main>
  );
}
