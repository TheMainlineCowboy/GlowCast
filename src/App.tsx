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

// ... [Existing Types Remain Same] ...
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
type ResizeAction = { target: EditTarget; id: number; mode: ResizeMode; startX: number; startY: number; original: ProjectZone; };
type SavedProject = { id: string; name: string; savedAt: string; imageUrl: string | null; thumbnailUrl?: string | null; imageSize: ImageSize; surfaceZone: Zone | null; zones: ProjectZone[]; activeEffect: string; invertMode: boolean; projectionContent: ProjectionContent; videoUrl: string | null; };
type RecentPhoto = { id: string; name: string; usedAt: string; imageUrl: string; thumbnailUrl: string; imageSize: ImageSize; };

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses, lightning flashes, and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow for holiday mapping" },
  { id: "rain", name: "Rainfall", description: "Soft rain streaks that respect avoid masks" },
  { id: "neon", name: "Neon Glow", description: "Business sign or party-style electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement for dramatic projection" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

const shapeOptions: { id: MaskShape; name: string }[] = [
  { id: "rectangle", name: "Rectangle" },
  { id: "oval", name: "Circle / Oval" },
  { id: "triangle", name: "Triangle" },
  { id: "freehand", name: "Freehand-ish" }
];

const handles: ResizeMode[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const RECENT_PROJECTS_KEY = "glowcast-recent-projects";
const RECENT_PHOTOS_KEY = "glowcast-recent-photos";
const RECENT_PHOTO_LIMIT = 10;
const SAFE = 1.6;
const cornerNames = ["top-left", "top-right", "bottom-right", "bottom-left"];

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const num = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({
  left: `${zone.x}%`,
  top: `${zone.y}%`,
  width: `${zone.width}%`,
  height: `${zone.height}%`
});

const shapeClass = (shape?: MaskShape) => `shape-${shape ?? "rectangle"}`;

const defaultSurface = (): Zone => ({
  id: -1, x: 8, y: 14, width: 84, height: 72, included: true, label: "projection surface"
});

const flattenedSurface = (): Zone => ({
  id: -1, x: 0, y: 0, width: 100, height: 100, included: true, label: "flattened projection surface"
});

// Helper for masking
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const importProjectRef = useRef<HTMLInputElement | null>(null);

  // States
  const [step, setStep] = useState<Step>("start");
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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
  const [draftZone, setDraftZone] = useState<DraftZone | null>(null);
  const [resizeAction, setResizeAction] = useState<ResizeAction | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState("Upload a reference photo to start mapping.");
  const [debugWarnings, setDebugWarnings] = useState<string[]>([]);
  const [cornerMode, setCornerMode] = useState(false);
  const [cornerPoints, setCornerPoints] = useState<Point[]>([]);
  const [surfacePolygonMode, setSurfacePolygonMode] = useState(false); 
  const [surfacePolygonPoints, setSurfacePolygonPoints] = useState<SurfacePoint[]>([]); 
  const [surfacePolygonClosed, setSurfacePolygonClosed] = useState(false); 
  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);
  const [showEdges, setShowEdges] = useState(false);
  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);
  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);
  const [edgeScanning, setEdgeScanning] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const projectionArea = surfaceZone;
  const effectClass = `effect-${activeEffect}`;
  const hasProject = Boolean(imageUrl || surfaceZone || zones.length || videoUrl);
  const draftRect = draftZone ? {
    x: Math.min(draftZone.startX, draftZone.currentX),
    y: Math.min(draftZone.startY, draftZone.currentY),
    width: Math.abs(draftZone.startX - draftZone.currentX),
    height: Math.abs(draftZone.startY - draftZone.currentY),
    shape: draftZone.shape
  } : null;

  const includedZones = useMemo(() => zones.filter(z => z.included), [zones]);

  // --- STEP 2 & 3: MASK LOGIC ---
  function renderProjectionLayer(extra = "") {
    return projectionContent === "video" && videoUrl ? (
      <video className={`projectionVideo ${extra}`} src={videoUrl} autoPlay muted loop playsInline />
    ) : (
      <div className={`effectFill ${effectClass} ${extra}`} />
    );
  }

  function renderPolygonProjectionLayer() {
    if (!surfacePolygonClosed || surfacePolygonPoints.length < 3) return null;
    const polygonPoints = surfacePolygonPoints
      .map((point) => `${point.x},${point.y}`)
      .join(" ");
    const maskId = "polygonProjectionMask";
    return (
      <svg className="polygonProjectionLayer" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="black" />
            <polygon points={polygonPoints} fill="white" />
            {zones
              .filter((zone) => zone.included)
              .map((zone) => (
                <rect key={zone.id} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />
              ))}
          </mask>
        </defs>
        <foreignObject x="0" y="0" width="100" height="100" mask={`url(#${maskId})`}>
          <div className="polygonProjectionForeign">
            {renderProjectionLayer("polygonProjectionEffect")}
          </div>
        </foreignObject>
      </svg>
    );
  }

  // --- Handlers ---
  function distanceBetweenPoints(a: SurfacePoint, b: SurfacePoint) { 
    const dx = a.x - b.x; 
    const dy = a.y - b.y; 
    return Math.sqrt(dx * dx + dy * dy); 
  }

  function addSurfacePolygonPoint(point: SurfacePoint) { 
    setSurfacePolygonPoints((current) => { 
      if (current.length >= 3) { 
        const first = current[0]; 
        if (distanceBetweenPoints(point, first) <= 3) { 
          setSurfacePolygonMode(false); 
          setSurfacePolygonClosed(true); 
          setShowSurfaceHandles(false); 
          setDetectMessage("Projection surface polygon set."); 
          return current; 
        } 
      } 
      return [...current, point]; 
    }); 
  } 

  function getPoint(event: React.PointerEvent<HTMLElement>) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100)
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (surfacePolygonMode) {
      const pt = getPoint(event);
      if (pt) addSurfacePolygonPoint(pt);
      return;
    }
    // ... rest of pointer down logic ...
    if (!imageUrl || !drawMode || projectionOnly) return;
    const pt = getPoint(event);
    if (!pt) return;
    setDraftZone({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y, shape: drawShape });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeAction) {
        // resize logic
        return;
    }
    if (!draftZone) return;
    const pt = getPoint(event);
    if (pt) setDraftZone(prev => prev ? {...prev, currentX: pt.x, currentY: pt.y} : null);
  }

  function handlePointerUp() {
    if (draftZone) {
        const rect = draftRect!;
        if (rect.width > 1 && rect.height > 1) {
            setZones(prev => [...prev, { id: Date.now(), ...rect, included: true, label: "mask" }]);
        }
        setDraftZone(null);
    }
    setResizeAction(null);
  }

  return (
    <main className="appShell">
      {/* ... Hero and Nav sections (identical to your original) ... */}
      
      {step === "mask" && (
        <section className="workspace">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Surface + Masks</h2>
              <button 
                onClick={() => { setSurfacePolygonMode(true); setSurfacePolygonClosed(false); setSurfacePolygonPoints([]); }}
                className={surfacePolygonMode ? "activeEffect" : ""}
              >
                Draw Projection Surface
              </button>
              <button className="primary" onClick={() => setProjectionOnly(!projectionOnly)}>
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>
            </div>
          </aside>

          <section className="stageWrap">
            <div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>
              <div 
                ref={surfaceRef}
                className="surfaceLayer" 
                style={{ aspectRatio: `${imageSize.width}/${imageSize.height}` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {imageUrl && <img ref={imageRef} className="referencePhoto" src={imageUrl} alt="" draggable={false} />}
                
                {/* --- PATCH: STEPS 4, 5, 6 --- */}
                {renderPolygonProjectionLayer()}

                {!surfacePolygonClosed ? (
                  projectionArea && (
                    <div className="projectionSurface" style={toStyle(projectionArea)}>
                      {renderProjectionLayer()}
                    </div>
                  )
                ) : null}

                {/* Setup Overlays (Zones, handles, etc) */}
                {!projectionOnly && zones.map(zone => (
                  <div key={zone.id} className={`zone ${shapeClass(zone.shape)}`} style={toStyle(zone)}>
                    <span>{zones.indexOf(zone) + 1}</span>
                  </div>
                ))}
                
                {draftRect && <div className="draftZone" style={toStyle(draftRect)} />}
                
                {/* Polygon UI overlay */}
                <svg className="polygonUI" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute', inset:0, pointerEvents:'none'}}>
                    {surfacePolygonPoints.length > 1 && (
                        <polyline points={surfacePolygonPoints.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="yellow" strokeWidth="0.5" />
                    )}
                </svg>
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
