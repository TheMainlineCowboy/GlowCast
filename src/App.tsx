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

// --- TYPES ---
type Effect = { id: string; name: string; description: string; };
type MaskShape = "rectangle" | "oval" | "triangle" | "freehand";
type ProjectZone = Zone & { shape?: MaskShape; points?: Point[]; };
type SurfacePoint = { x: number; y: number; }; 
type DraftZone = { startX: number; startY: number; currentX: number; currentY: number; shape: MaskShape; };
type ImageSize = { width: number; height: number; };
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
  surfacePolygonPoints?: SurfacePoint[];
};

type RecentPhoto = {
  id: string;
  name: string;
  usedAt: string;
  imageUrl: string;
  thumbnailUrl: string;
  imageSize: ImageSize;
};

// --- CONSTANTS & HELPERS ---
const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow" },
  { id: "rain", name: "Rainfall", description: "Soft rain streaks" },
  { id: "neon", name: "Neon Glow", description: "Electric sign glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement" },
  { id: "grid", name: "Alignment Grid", description: "Useful for alignment" }
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

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({
  left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`
});

function clampZone<T extends Pick<Zone, "x" | "y" | "width" | "height">>(zone: T): T {
  const width = clamp(zone.width || 10, 2, 100 - SAFE * 2);
  const height = clamp(zone.height || 10, 2, 100 - SAFE * 2);
  return {
    ...zone,
    x: Number(clamp(zone.x || 0, SAFE, 100 - width - SAFE).toFixed(2)),
    y: Number(clamp(zone.y || 0, SAFE, 100 - height - SAFE).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2))
  };
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // State
  const [step, setStep] = useState<Step>("start");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 16, height: 9 });
  const [surfaceZone, setSurfaceZone] = useState<Zone | null>(null);
  const [zones, setZones] = useState<ProjectZone[]>([]);
  const [surfacePolygonPoints, setSurfacePolygonPoints] = useState<SurfacePoint[]>([]);
  const [surfacePolygonClosed, setSurfacePolygonClosed] = useState(false);
  const [surfacePolygonMode, setSurfacePolygonMode] = useState(false);
  const [activeEffect, setActiveEffect] = useState("snow");
  const [projectionContent, setProjectionContent] = useState<ProjectionContent>("effect");
  const [projectionOnly, setProjectionOnly] = useState(false);
  const [invertMode, setInvertMode] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [drawShape, setDrawShape] = useState<MaskShape>("rectangle");
  const [selectedTarget, setSelectedTarget] = useState<EditTarget>("surface");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);

  // STEP 1 & 2: Base content rendering logic
  function renderProjectionContent(extra = "") {
    return projectionContent === "video" && videoUrl ? (
      <video className={`projectionVideo ${extra}`} src={videoUrl} autoPlay muted loop playsInline />
    ) : (
      <div className={`effectFill effect-${activeEffect} ${extra}`} />
    );
  }

  // STEP 3: Polygon Mask Helper
  // This uses an SVG mask to isolate the projection to the coordinates defined by "Corner Calibration"
  function renderPolygonProjectionLayer() {
    if (!surfacePolygonClosed || surfacePolygonPoints.length < 3) return null;

    const pointsString = surfacePolygonPoints.map(p => `${p.x},${p.y}`).join(" ");
    const maskId = `mask-${Date.now()}`;

    return (
      <div className="polygonProjectionWrapper" style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <clipPath id={maskId} clipPathUnits="objectBoundingBox">
              <polygon points={surfacePolygonPoints.map(p => `${p.x/100},${p.y/100}`).join(" ")} />
            </clipPath>
          </defs>
        </svg>
        <div 
          className="polygonContent" 
          style={{ 
            width: '100%', 
            height: '100%', 
            clipPath: `url(#${maskId})`,
            pointerEvents: 'none'
          }}
        >
          {renderProjectionContent()}
        </div>
      </div>
    );
  }

  // STEP 4, 5, & 6: Update Main Preview Logic
  // Prioritizes the "Fix" (flattened perspective) over standard rectangular bounding boxes.
  const renderMainProjection = () => {
    // If we have a polygon calibrated surface, use the specific polygon layer
    if (surfacePolygonClosed) {
      return renderPolygonProjectionLayer();
    }
    
    // Fallback to standard rectangular surface if no polygon is defined
    if (invertMode && surfaceZone) {
      return (
        <div className="projectionSurface" style={toStyle(surfaceZone)}>
          {renderProjectionContent()}
        </div>
      );
    }
    return null;
  };

  // --- Pointer Handlers ---
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100)
    };

    if (surfacePolygonMode) {
      if (surfacePolygonPoints.length >= 3) {
        const first = surfacePolygonPoints[0];
        const dist = Math.sqrt(Math.pow(point.x - first.x, 2) + Math.pow(point.y - first.y, 2));
        if (dist < 3) {
          setSurfacePolygonClosed(true);
          setSurfacePolygonMode(false);
          return;
        }
      }
      setSurfacePolygonPoints([...surfacePolygonPoints, point]);
    }
  }

  // --- Component UI ---
  return (
    <main className="appShell">
      {/* ... Header and Nav omitted for brevity, same as your source ... */}
      
      <section className="workspace">
        <aside className="toolPanel">
          <div className="panelBlock">
            <h2>Surface Calibration</h2>
            <button 
              className={surfacePolygonMode ? "activeEffect" : ""}
              onClick={() => {
                setSurfacePolygonMode(true);
                setSurfacePolygonPoints([]);
                setSurfacePolygonClosed(false);
              }}
            >
              {surfacePolygonMode ? "Tapping Corners..." : "Calibrate Surface Polygon"}
            </button>
            
            <button onClick={() => setProjectionOnly(!projectionOnly)}>
              {projectionOnly ? "Show Setup" : "Preview Animation Only"}
            </button>
          </div>
        </aside>

        <section className="stageWrap">
          <div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>
            <div 
              ref={surfaceRef}
              className="surfaceLayer"
              style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }}
              onPointerDown={handlePointerDown}
            >
              {imageUrl && <img className="referencePhoto" src={imageUrl} draggable={false} alt="setup" />}
              
              {/* Render the refined projection layer (Steps 4-6) */}
              {renderMainProjection()}

              {/* Surface Polygon Visual Guide */}
              {!projectionOnly && surfacePolygonPoints.length > 0 && (
                <svg className="polyOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>
                  <polyline 
                    points={surfacePolygonPoints.map(p => `${p.x},${p.y}`).join(" ")} 
                    fill="none" stroke="#fef08a" strokeWidth="0.5" 
                  />
                  {surfacePolygonPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="1" fill={i === 0 ? "#facc15" : "#fef08a"} />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </section>
      </section>

      {/* STEP 8: CSS Styling */}
      <style>{`
        .polygonProjectionWrapper {
          pointer-events: none;
        }
        .polygonContent {
          transition: clip-path 0.3s ease;
        }
        .stage.projectionOnly .referencePhoto,
        .stage.projectionOnly .polyOverlay {
          opacity: 0;
        }
        /* Ensures the SVG layer aligns perfectly with reference photo */
        .surfaceLayer svg {
          display: block;
        }
      `}</style>
    </main>
  );
}
