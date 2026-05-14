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

type Effect = {
  id: string;
  name: string;
  description: string;
};

type MaskShape = "rectangle" | "oval" | "triangle" | "freehand";

type ProjectZone = Zone & {
  shape?: MaskShape;
  points?: Point[]; 
};

type DraftZone = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shape: MaskShape;
};

type ImageSize = {
  width: number;
  height: number;
};

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

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const num = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({
  left: `${zone.x}%`,
  top: `${zone.y}%`,
  width: `${zone.width}%`,
  height: `${zone.height}%`
});

const shapeClass = (shape?: MaskShape) => `shape-${shape ?? "rectangle"}`;

const defaultSurface = (): Zone => ({
  id: -1,
  x: 8,
  y: 14,
  width: 84,
  height: 72,
  included: true,
  label: "projection surface"
});

const flattenedSurface = (): Zone => ({
  id: -1,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  included: true,
  label: "flattened projection surface"
});

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const getRecentProjects = (): SavedProject[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || "[]");
  } catch {
    return [];
  }
};

const getRecentPhotos = (): RecentPhoto[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PHOTOS_KEY) || "[]");
  } catch {
    return [];
  }
};

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

function normalizeDraftZone(draft: DraftZone): Omit<ProjectZone, "id" | "included"> {
  const x1 = Math.min(draft.startX, draft.currentX);
  const y1 = Math.min(draft.startY, draft.currentY);
  const x2 = Math.max(draft.startX, draft.currentX);
  const y2 = Math.max(draft.startY, draft.currentY);

  return clampZone({
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    shape: draft.shape
  });
}

async function createThumbnail(src: string, max = 220) {
  const image = await loadImage(src);
  const ratio = Math.min(max / image.naturalWidth, max / image.naturalHeight, 1);
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function photosFromProjects(projects: SavedProject[]): RecentPhoto[] {
  return projects
    .filter((project) => project.imageUrl)
    .map((project) => ({
      id: `project-${project.id}`,
      name: project.name || "Autosaved photo",
      usedAt: project.savedAt || new Date().toISOString(),
      imageUrl: project.imageUrl as string,
      thumbnailUrl: project.thumbnailUrl || (project.imageUrl as string),
      imageSize: project.imageSize || { width: 16, height: 9 }
    }));
}

function mergePhotos(a: RecentPhoto[], b: RecentPhoto[]) {
  const map = new Map<string, RecentPhoto>();

  [...a, ...b].forEach((photo) => {
    if (photo.imageUrl && !map.has(photo.imageUrl)) {
      map.set(photo.imageUrl, photo);
    }
  });

  return [...map.values()].slice(0, RECENT_PHOTO_LIMIT);
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const importProjectRef = useRef<HTMLInputElement | null>(null);

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
  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);

  const [showEdges, setShowEdges] = useState(false);
  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);
  const [edgePoints, setEdgePoints] = useState<EdgePoint[]>([]);
  const [edgeScanning, setEdgeScanning] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const projectionArea = surfaceZone ?? defaultSurface();

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [zones, selectedZoneId]
  );

  const selectedEditable = selectedTarget === "surface" ? projectionArea : selectedZone;
  const includedZones = zones.filter((zone) => zone.included);
  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;
  const effectClass = `effect-${activeEffect}`;
  const hasProject = Boolean(imageUrl || surfaceZone || zones.length || videoUrl);

  const visibleRecentPhotos = useMemo(
    () => mergePhotos(recentPhotos, photosFromProjects(recentProjects)),
    [recentPhotos, recentProjects]
  );

  useEffect(() => {
    const projects = getRecentProjects();
    const photos = mergePhotos(getRecentPhotos(), photosFromProjects(projects));

    setRecentProjects(projects);
    setRecentPhotos(photos);

    try {
      localStorage.setItem(RECENT_PHOTOS_KEY, JSON.stringify(photos));
    } catch {}
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setProjectorMode(false);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!hasProject) return;

    const timer = window.setTimeout(() => {
      const project: SavedProject = {
        id: String(Date.now()),
        name: `GlowCast Project ${new Date().toLocaleString()}`,
        savedAt: new Date().toISOString(),
        imageUrl,
        thumbnailUrl: thumb ?? imageUrl,
        imageSize,
        surfaceZone,
        zones,
        activeEffect,
        invertMode,
        projectionContent,
        videoUrl
      };

      const recent = [project, ...getRecentProjects()].slice(0, 5);

      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
        setRecentProjects(recent);
      } catch {}
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    imageUrl,
    thumb,
    imageSize,
    surfaceZone,
    zones,
    activeEffect,
    invertMode,
    projectionContent,
    videoUrl,
    hasProject
  ]);

  function getPoint(event: React.PointerEvent<HTMLElement>, allowSnap = true) {
    const surface = surfaceRef.current;
    if (!surface) return null;

    const rect = surface.getBoundingClientRect();

    const rawPoint = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100)
    };

    if (!allowSnap || !snapEnabled || !showEdges || !edgePoints.length) {
      return rawPoint;
    }

    return snapPointToEdge(rawPoint, edgePoints);
  }

  function rememberPhoto(photo: RecentPhoto) {
    const recent = mergePhotos([photo], getRecentPhotos());
    try {
      localStorage.setItem(RECENT_PHOTOS_KEY, JSON.stringify(recent));
      setRecentPhotos(recent);
    } catch {}
  }

  function resetEdgeScanner() {
    setShowEdges(false);
    setEdgeOverlayUrl(null);
    setEdgePoints([]);
    setEdgeScanning(false);
    setSnapEnabled(true);
  }

  async function toggleEdgeScanner() {
    if (!imageUrl) return;
    if (showEdges) {
      setShowEdges(false);
      return;
    }
    try {
      setEdgeScanning(true);
      setDetectMessage("Scanning local architectural edges...");
      const result = await scanImageEdges(imageUrl);
      setEdgeOverlayUrl(result.edgeCanvasUrl);
      setEdgePoints(result.edgePoints);
      setShowEdges(true);
      setDetectMessage(
        `Edge scanner found ${result.edgePoints.length.toLocaleString()} architectural edge points. Use masks near trim lines for snapping.`
      );
    } catch (error) {
      setDebugWarnings([
        error instanceof Error ? error.message : "Edge scanner failed."
      ]);
      setDetectMessage("Edge scanner failed. You can still use manual masks.");
    } finally {
      setEdgeScanning(false);
    }
  }

  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {
    setImageUrl(src);
    setThumb(thumbnail ?? src);
    setImageSize(size);
    setSurfaceZone(defaultSurface());
    setShowSurfaceHandles(true);
    setZones([]);
    setSelectedTarget("surface");
    setSelectedZoneId(null);
    setDraftZone(null);
    setResizeAction(null);
    setDrawMode(false);
    setProjectionOnly(false);
    setDebugWarnings([]);
    setCornerMode(false);
    setCornerPoints([]);
    resetEdgeScanner();
    setStep("mask");
    setDetectMessage(message);
  }

  function loadProject(project: SavedProject) {
    setImageUrl(project.imageUrl ?? null);
    setThumb(project.thumbnailUrl ?? project.imageUrl ?? null);
    setVideoUrl(project.videoUrl ?? null);
    setImageSize(project.imageSize ?? { width: 16, height: 9 });
    setSurfaceZone(project.surfaceZone ?? defaultSurface());
    setZones(project.zones ?? []);
    setSelectedTarget("surface");
    setSelectedZoneId(null);
    setActiveEffect(project.activeEffect ?? "snow");
    setInvertMode(project.invertMode ?? true);
    setProjectionContent(project.projectionContent ?? "effect");
    setProjectionOnly(false);
    setDebugWarnings([]);
    setCornerMode(false);
    setCornerPoints([]);
    resetEdgeScanner();
    setStep("mask");
    setDetectMessage("Project loaded. Tap the surface or a mask to edit it.");
  }

  function loadRecentPhoto(photo: RecentPhoto) {
    resetForPhoto(
      photo.imageUrl,
      photo.thumbnailUrl,
      photo.imageSize,
      "Recent photo loaded. Use Set Wall Corners for zero-cost precision mode."
    );

    rememberPhoto({
      ...photo,
      usedAt: new Date().toISOString()
    });
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const src = await readFileAsDataUrl(file);
    const image = await loadImage(src);
    const size = {
      width: image.naturalWidth || 16,
      height: image.naturalHeight || 9
    };
    const thumbnail = await createThumbnail(src);

    resetForPhoto(
      src,
      thumbnail,
      size,
      "Photo loaded. Use Set Wall Corners for zero-cost precision, or drag the surface handles manually."
    );

    rememberPhoto({
      id: String(Date.now()),
      name: file.name || `Recent photo ${new Date().toLocaleString()}`,
      usedAt: new Date().toISOString(),
      imageUrl: src,
      thumbnailUrl: thumbnail,
      imageSize: size
    });

    event.target.value = "";
  }

  async function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoUrl(await readFileAsDataUrl(file));
    setProjectionContent("video");
    setProjectionOnly(true);
    setDebugWarnings([]);
    setCornerMode(false);
    setCornerPoints([]);
    setDetectMessage("Projection video loaded. Preview output without the reference photo.");
  }

  function startCornerCalibration() {
    setCornerMode(true);
    setCornerPoints([]);
    setDrawMode(false);
    setProjectionOnly(false);
    setResizeAction(null);
    setDraftZone(null);
    setDebugWarnings([]);
    setDetectMessage("Tap wall corners in order: top-left, top-right, bottom-right, bottom-left.");
  }

  async function finishCornerCalibration(points: Quad) {
    if (!imageUrl) return;

    try {
      setDetectMessage("Flattening wall into natural aspect ratio...");
      const image = await loadImage(imageUrl);
      
      const topWidth = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y); 
      const bottomWidth = Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y); 
      const leftHeight = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y); 
      const rightHeight = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y); 
      
      const averageWidth = Math.max((topWidth + bottomWidth) / 2, 1); 
      const averageHeight = Math.max((leftHeight + rightHeight) / 2, 1); 
      const aspectRatio = averageHeight / averageWidth; 
      
      const outputWidth = 1600; 
      const outputHeight = Math.max(300, Math.round(outputWidth * aspectRatio)); 
      
      const canvas = warpImageToCanvas(image, points, outputWidth, outputHeight); 
      const flattened = canvas.toDataURL("image/jpeg", 0.92); 
      const thumbnail = await createThumbnail(flattened); 
      
      setImageUrl(flattened); 
      setThumb(thumbnail); 
      setImageSize({ width: outputWidth, height: outputHeight }); 

      setSurfaceZone(flattenedSurface());
      setShowSurfaceHandles(false);
      
      setCornerMode(false);
      setCornerPoints([]);
      setDrawMode(false);
      setProjectionOnly(false);
      resetEdgeScanner();
      setDetectMessage("Wall straightened. Add masks to define projection and avoidance areas.");
    } catch (error) {
      setDebugWarnings([error instanceof Error ? error.message : "Wall flattening failed."]);
      setDetectMessage("Wall flattening failed. Try choosing the four corners again.");
    }
  }

  function updateSurface(update: Partial<Zone>) {
    setSurfaceZone((current) => ({
      ...clampZone({
        ...(current ?? defaultSurface()),
        ...update
      }),
      id: -1,
      included: true,
      label: "projection surface"
    }));
  }

  function addZone(shape: MaskShape = drawShape) {
    const id = Date.now();

    setZones((current) => [
      ...current,
      clampZone({
        id,
        x: 18,
        y: 18,
        width: 24,
        height: 22,
        included: true,
        label: `manual ${shape} avoid zone`,
        shape
      })
    ]);

    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
  }

  function updateSelectedZone(update: Partial<ProjectZone>) {
    if (!selectedZoneId) return;

    setZones((current) =>
      current.map((zone) =>
        zone.id === selectedZoneId
          ? clampZone({
              ...zone,
              ...update
            })
          : zone
      )
    );
  }

  function updateSelectedEditable(update: Partial<ProjectZone>) {
    if (selectedTarget === "surface") {
      updateSurface(update);
    } else {
      updateSelectedZone(update);
    }
  }

  function deleteSelectedZone() {
    if (!selectedZoneId) return;

    setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
    setSelectedTarget("surface");
    setSelectedZoneId(null);
  }

  function duplicateSelectedZone() {
    if (!selectedZone) return;

    const id = Date.now();

    setZones((current) => [
      ...current,
      clampZone({
        ...selectedZone,
        id,
        x: selectedZone.x + 3,
        y: selectedZone.y + 3,
        label: `copy of ${selectedZone.label ?? "mask"}`
      })
    ]);

    setSelectedZoneId(id);
    setSelectedTarget("zone");
  }

  function applyResize(action: ResizeAction, point: { x: number; y: number }) {
    const dx = point.x - action.startX;
    const dy = point.y - action.startY;
    const original = action.original;

    let x = original.x;
    let y = original.y;
    let width = original.width;
    let height = original.height;

    if (action.mode === "move") {
      x += dx;
      y += dy;
    }

    if (action.mode.includes("e")) width += dx;
    if (action.mode.includes("s")) height += dy;

    if (action.mode.includes("w")) {
      x += dx;
      width -= dx;
    }

    if (action.mode.includes("n")) {
      y += dy;
      height -= dy;
    }

    const update = clampZone({
      x,
      y,
      width,
      height
    });

    if (action.target === "surface") {
      updateSurface(update);
    } else {
      setZones((current) =>
        current.map((zone) =>
          zone.id === action.id
            ? {
                ...zone,
                ...update
              }
            : zone
        )
      );
    }
  }

  function startResize(
    event: React.PointerEvent<HTMLElement>,
    target: EditTarget,
    zone: ProjectZone,
    mode: ResizeMode
  ) {
    const point = getPoint(event);
    if (!point) return;

    event.stopPropagation();

    setSelectedTarget(target);
    setSelectedZoneId(target === "zone" ? zone.id : null);
    setDrawMode(false);
    setCornerMode(false);
    setCornerPoints([]);
    setProjectionOnly(false);
    setResizeAction({
      target,
      id: zone.id,
      mode,
      startX: point.x,
      startY: point.y,
      original: {
        ...zone
      }
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeAction) return;

    if (cornerMode && imageUrl && !projectionOnly) {
      const point = getPoint(event, false);
      if (!point) return;

      event.preventDefault();
      event.stopPropagation();

      const next = [...cornerPoints, point];
      setCornerPoints(next);

      if (next.length < 4) {
        setDetectMessage(`Tap wall corners in order: ${cornerNames[next.length]}.`);
      } else {
        setDetectMessage("Corners selected. Flattening wall...");
        void finishCornerCalibration(next as Quad);
      }

      return;
    }

    if (
      !imageUrl ||
      !drawMode ||
      projectionOnly ||
      (event.target as HTMLElement).closest(".zone,.projectionBoundary")
    ) {
      return;
    }

    const point = getPoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTarget("zone");
    setSelectedZoneId(null);
    setDraftZone({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      shape: drawShape
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = getPoint(event);
    if (!point) return;

    if (resizeAction) {
      applyResize(resizeAction, point);
      return;
    }

    if (!draftZone || !drawMode || projectionOnly || cornerMode) return;

    setDraftZone((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y
          }
        : current
    );
  }

  function finishPointerAction() {
    setResizeAction(null);

    if (!draftZone) return;

    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);

    if (rect.width < 2 || rect.height < 2) return;

    const id = Date.now();

    setZones((current) => [
      ...current,
      {
        id,
        ...rect,
        included: true,
        label: `manual ${draftZone.shape} avoid zone`
      }
    ]);

    setSelectedTarget("zone");
    setSelectedZoneId(id);
  }

  async function openProjectorMode() {
    if (!hasProject) return;

    setProjectionOnly(true);
    setProjectorMode(true);

    window.setTimeout(() => {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }, 50);
  }

  async function closeProjectorMode() {
    setProjectorMode(false);

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  }

  function exportProjectFile() {
    const project: SavedProject = {
      id: String(Date.now()),
      name: `GlowCast Project ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      imageUrl,
      thumbnailUrl: thumb ?? imageUrl,
      imageSize,
      surfaceZone,
      zones,
      activeEffect,
      invertMode,
      projectionContent,
      videoUrl
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json"
    });

    const anchor = document.createElement("a");
    anchor.download = "glowcast-project.json";
    anchor.href = URL.createObjectURL(blob);
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function importProjectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      loadProject(JSON.parse(await file.text()));
    } catch {
      setDetectMessage("Could not load that project file.");
    } finally {
      event.target.value = "";
    }
  }

  function exportAlignmentGuide() {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;

    for (let x = 0; x <= canvas.width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 120) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 10;
    ctx.strokeRect(
      (projectionArea.x / 100) * canvas.width,
      (projectionArea.y / 100) * canvas.height,
      (projectionArea.width / 100) * canvas.width,
      (projectionArea.height / 100) * canvas.height
    );

    zones.forEach((zone, index) => {
      const x = (zone.x / 100) * canvas.width;
      const y = (zone.y / 100) * canvas.height;
      const width = (zone.width / 100) * canvas.width;
      const height = (zone.height / 100) * canvas.height;

      ctx.strokeStyle = zone.included ? "#fef08a" : "#fb7185";
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px Arial";
      ctx.fillText(`${index + 1}`, x + 20, y + 60);
    });

    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px Arial";
    ctx.fillText("GlowCast Alignment Guide", 40, canvas.height - 50);

    const anchor = document.createElement("a");
    anchor.download = "glowcast-alignment-guide.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }

  function renderProjectionLayer(extra = "") {
    return projectionContent === "video" && videoUrl ? (
      <video
        className={`projectionVideo ${extra}`}
        src={videoUrl}
        autoPlay
        muted
        loop
        playsInline
      />
    ) : (
      <div className={`effectFill ${effectClass} ${extra}`} />
    );
  }

  function renderHandles(target: EditTarget, zone: ProjectZone) {
    const selected =
      selectedTarget === target && (target === "surface" || selectedZoneId === zone.id);

    if (!selected || projectionOnly || cornerMode) return null;

    return handles.map((handle) => (
      <i
        key={handle}
        className={`resizeHandle handle-${handle}`}
        onPointerDown={(event) => startResize(event, target, zone, handle)}
      />
    ));
  }

  function cornerOverlay() {
    if (!cornerMode && !cornerPoints.length) return null;

    const line = cornerPoints.map((point) => `${point.x},${point.y}`).join(" ");

    return (
      <>
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 8
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={line}
            fill="none"
            stroke="#22d3ee"
            strokeWidth=".5"
          />
          {cornerPoints.length === 4 && (
            <polygon
              points={line}
              fill="rgba(34,211,238,.12)"
              stroke="#22d3ee"
              strokeWidth=".5"
            />
          )}
        </svg>

        {cornerPoints.map((point, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${point.x}%`,
              top: `${point.y}%`,
              transform: "translate(-50%,-50%)",
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "#22d3ee",
              color: "#001018",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              zIndex: 9,
              boxShadow: "0 0 0 3px rgba(0,0,0,.6)"
            }}
          >
            {index + 1}
          </div>
        ))}
      </>
    );
  }

  if (projectorMode) {
    return (
      <main className="projectorShell">
        <button className="projectorExit" onClick={closeProjectorMode}>
          Exit Projector
        </button>

        <div
          className="projectorCanvas"
          style={{
            aspectRatio: `${imageSize.width} / ${imageSize.height}`
          }}
        >
          {invertMode && (
            <div className="projectionSurface" style={toStyle(projectionArea)}>
              {renderProjectionLayer("projectorEffect")}
            </div>
          )}

          {invertMode &&
            includedZones.map((zone) => (
              <div
                key={`pc-${zone.id}`}
                className={`projectorMaskCutout ${shapeClass(zone.shape)}`}
                style={{
                   ...toStyle(zone),
                   clipPath: zone.points ? `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(",")})` : "none"
                }}
              />
            ))}

          {!invertMode &&
            includedZones.map((zone) => (
              <div
                key={`pf-${zone.id}`}
                className={`zoneProjection ${shapeClass(zone.shape)}`}
                style={{
                   ...toStyle(zone),
                   clipPath: zone.points ? `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(",")})` : "none"
                }}
              >
                {renderProjectionLayer("projectorEffect")}
              </div>
            ))}
        </div>
      </main>
    );
  }

  const stage = (
    <section className="stageWrap">
      <div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>
        {!imageUrl && !videoUrl && (
          <div className="emptyState">
            <ScanLine size={48} />
            <h2>No project loaded yet.</h2>
            <p>Upload a reference photo from the Start page.</p>
          </div>
        )}

        {(imageUrl || videoUrl) && (
          <div
            ref={surfaceRef}
            className={`surfaceLayer ${drawMode ? "drawMode" : ""}`}
            style={{
              aspectRatio: `${imageSize.width} / ${imageSize.height}`
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerAction}
            onPointerCancel={finishPointerAction}
          >
            {imageUrl && (
              <img
                className="referencePhoto"
                src={imageUrl}
                alt="Projection surface"
                draggable={false}
              />
            )}

            {showEdges && edgeOverlayUrl && !projectionOnly ? (
              <img
                src={edgeOverlayUrl}
                className="edgeOverlay"
                alt=""
                draggable={false}
              />
            ) : null}

            {cornerOverlay()}

            {showSurfaceHandles && !projectionOnly && !cornerMode ? (
              <div
                className={`projectionBoundary ${
                  selectedTarget === "surface" ? "selectedSurface" : ""
                }`}
                style={toStyle(projectionArea)}
                onPointerDown={(event) =>
                  startResize(event, "surface", projectionArea as ProjectZone, "move")
                }
              >
                <b>surface</b>
                {renderHandles("surface", projectionArea as ProjectZone)}
              </div>
            ) : null}

            {invertMode && (
              <div className="projectionSurface" style={toStyle(projectionArea)}>
                {renderProjectionLayer()}
              </div>
            )}

            {invertMode &&
              includedZones.map((zone) => (
                <div
                  key={`cut-${zone.id}`}
                  className={`maskCutout ${shapeClass(zone.shape)}`}
                  style={{
                    ...toStyle(zone),
                    backgroundImage:
                      projectionOnly || !imageUrl ? "none" : `url(${imageUrl})`,
                    backgroundSize: `${10000 / zone.width}% ${
                      10000 / zone.height
                    }%`,
                    backgroundPosition: `${
                      zone.x >= 100 - zone.width
                        ? 100
                        : (zone.x / (100 - zone.width)) * 100
                    }% ${
                      zone.y >= 100 - zone.height
                        ? 100
                        : (zone.y / (100 - zone.height)) * 100
                    }%`,
                    clipPath: zone.points ? `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(",")})` : "none"
                  }}
                />
              ))}

            {!invertMode &&
              includedZones.map((zone) => (
                <div
                  key={`fx-${zone.id}`}
                  className={`zoneProjection ${shapeClass(zone.shape)}`}
                  style={{
                    ...toStyle(zone),
                    clipPath: zone.points ? `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(",")})` : "none"
                  }}
                >
                  {renderProjectionLayer()}
                </div>
              ))}

            {!projectionOnly &&
              !cornerMode &&
              zones.map((zone, index) => (
                <div
                  key={zone.id}
                  className={`zone ${shapeClass(zone.shape)} ${
                    zone.included ? "included" : "excluded"
                  } ${
                    selectedTarget === "zone" && selectedZoneId === zone.id
                      ? "selected"
                      : ""
                  }`}
                  style={{
                    ...toStyle(zone),
                    clipPath: zone.points ? `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(",")})` : "none"
                  }}
                  onPointerDown={(event) => startResize(event, "zone", zone, "move")}
                >
                  <span>{index + 1}</span>
                  {renderHandles("zone", zone)}
                </div>
              ))}

            {draftRect && !projectionOnly && !cornerMode && (
              <div
                className={`draftZone ${shapeClass(draftRect.shape)}`}
                style={toStyle(draftRect)}
              />
            )}
          </div>
        )}
      </div>

      {selectedEditable && !projectionOnly && !cornerMode && (
        <div className="zoneEditor">
          <strong>
            {selectedTarget === "surface"
              ? "Projection Surface"
              : `Zone ${zones.findIndex((zone) => zone.id === selectedZoneId) + 1}`}
          </strong>

          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key === "x"
                ? "X"
                : key === "y"
                  ? "Y"
                  : key[0].toUpperCase() + key.slice(1)}
              <input
                type="number"
                value={selectedEditable[key]}
                min={0}
                max={100}
                onChange={(event) =>
                  updateSelectedEditable({
                    [key]: Number(event.target.value)
                  })
                }
              />
            </label>
          ))}

          {selectedTarget === "zone" && (
            <button
              onClick={() =>
                updateSelectedZone({
                  included: !selectedZone?.included
                })
              }
            >
              {selectedZone?.included ? "Included" : "Excluded"}
            </button>
          )}

          {selectedTarget === "zone" && (
            <button onClick={duplicateSelectedZone}>Duplicate</button>
          )}

          {selectedTarget === "zone" && (
            <button onClick={deleteSelectedZone}>
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      )}

      {selectedTarget === "zone" &&
        selectedZone &&
        !projectionOnly &&
        !cornerMode && (
          <div className="shapeEditor">
            {shapeOptions.map((shape) => (
              <button
                key={shape.id}
                className={selectedZone.shape === shape.id ? "activeEffect" : ""}
                onClick={() =>
                  updateSelectedZone({
                    shape: shape.id,
                    label: `manual ${shape.id} avoid zone`,
                    points: undefined 
                  })
                }
              >
                {shape.name}
              </button>
            ))}
          </div>
        )}
    </section>
  );

  return (
    <main className="appShell">
      <section className="heroPanel">
        <div>
          <p className="eyebrow">GlowCast MVP Prototype</p>
          <h1>
            {step === "start"
              ? "Start a projection map."
              : step === "mask"
                ? "Mask and edit the surface."
                : step === "content"
                  ? "Choose what projects."
                  : "Export or play it."}
          </h1>
          <p className="subtitle">
            Reference photos stay in setup. Projection preview shows only animation or
            video through your masks.
          </p>
        </div>
      </section>

      <nav className="stepNav">
        <button
          className={step === "start" ? "activeStep" : ""}
          onClick={() => setStep("start")}
        >
          1 Start
        </button>
        <button
          className={step === "mask" ? "activeStep" : ""}
          onClick={() => setStep("mask")}
          disabled={!hasProject}
        >
          2 Mask & Edit
        </button>
        <button
          className={step === "content" ? "activeStep" : ""}
          onClick={() => setStep("content")}
          disabled={!hasProject}
        >
          3 Content
        </button>
        <button
          className={step === "export" ? "activeStep" : ""}
          onClick={() => setStep("export")}
          disabled={!hasProject}
        >
          4 Export
        </button>
      </nav>

      {step === "start" && (
        <section className="startPage">
          <div className="startCard">
            <h2>Start with a reference photo</h2>
            <p>
              The photo is only for setup and alignment. The actual projection output
              will be animation or uploaded video only.
            </p>

            <label className="uploadButton">
              <ImagePlus size={20} />
              Upload Surface Photo
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </label>

            {visibleRecentPhotos.length > 0 && (
              <div className="recentPhotoBlock">
                <div className="recentHeader">
                  <strong>Recent Photos</strong>
                  <span>Tap to reuse</span>
                </div>
                <div className="recentPhotoRow">
                  {visibleRecentPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      className="recentPhotoButton"
                      onClick={() => loadRecentPhoto(photo)}
                      title={photo.name}
                    >
                      <img src={photo.thumbnailUrl} alt={photo.name} />
                      <span>{photo.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => importProjectRef.current?.click()}>
              <FolderOpen size={18} />
              Load Project File
            </button>

            <input
              ref={importProjectRef}
              className="hiddenInput"
              type="file"
              accept="application/json,.json"
              onChange={importProjectFile}
            />
          </div>

          <div className="startCard">
            <h2>Recent autosaves</h2>

            {recentProjects.length === 0 && (
              <p className="helperText">
                No recent projects saved in this browser yet.
              </p>
            )}

            <div className="recentProjectList">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  className="recentProjectButton"
                  onClick={() => loadProject(project)}
                >
                  {project.thumbnailUrl || project.imageUrl ? (
                    <img
                      src={project.thumbnailUrl ?? project.imageUrl ?? ""}
                      alt={project.name}
                    />
                  ) : (
                    <FolderOpen size={24} />
                  )}

                  <span>
                    <strong>{project.name}</strong>
                    <small>
                      {project.savedAt
                        ? new Date(project.savedAt).toLocaleString()
                        : "Recent autosave"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "mask" && (
        <section className="workspace">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Surface + Masks</h2>

              <button
                className="primary"
                onClick={startCornerCalibration}
                disabled={!imageUrl || detecting}
              >
                Set Wall Corners
              </button>

              <button
                type="button"
                onClick={() => setShowSurfaceHandles((current) => !current)}
                disabled={!imageUrl}
              >
                {showSurfaceHandles ? "Hide Surface Handles" : "Show Surface Handles"}
              </button>

              <button
                type="button"
                onClick={toggleEdgeScanner}
                disabled={!imageUrl || edgeScanning}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50"
              >
                {edgeScanning
                  ? "Scanning Edges..."
                  : showEdges
                    ? "Hide Edge Scanner"
                    : "Show Edge Scanner"}
              </button>

              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={(event) => setSnapEnabled(event.target.checked)}
                />
                Magnetic snap
              </label>

              {cornerMode && (
                <button
                  onClick={() => {
                    setCornerPoints([]);
                    setDetectMessage(
                      "Tap wall corners in order: top-left, top-right, bottom-right, bottom-left."
                    );
                  }}
                >
                  Reset Corners
                </button>
              )}

              <div className="shapeToolRow">
                {shapeOptions.map((shape) => (
                  <button
                    key={shape.id}
                    className={drawShape === shape.id ? "activeEffect" : ""}
                    onClick={() => {
                      setDrawShape(shape.id);
                      setDrawMode(true);
                      setProjectionOnly(false);
                      setCornerMode(false);
                      setCornerPoints([]);
                    }}
                  >
                    {shape.name}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setDrawMode((value) => !value);
                  setProjectionOnly(false);
                  setCornerMode(false);
                  setCornerPoints([]);
                }}
                disabled={!imageUrl}
              >
                {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
                {drawMode ? `Drawing ${drawShape}` : "Draw Avoid Zone"}
              </button>

              <button
                onClick={() => addZone(drawShape)}
                disabled={!imageUrl || cornerMode}
              >
                <Plus size={18} />
                Add {drawShape} Zone
              </button>

              <button
                className="primary"
                onClick={() => setProjectionOnly((value) => !value)}
                disabled={!hasProject}
              >
                {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
                {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
              </button>

              <p className="helperText">
                {cornerMode
                  ? `Corner ${Math.min(cornerPoints.length + 1, 4)} of 4: ${
                      cornerNames[cornerPoints.length] ?? "complete"
                    }`
                  : drawMode
                    ? `Drag directly on the photo to draw a ${drawShape} avoid mask.`
                    : detectMessage}
              </p>

              {debugWarnings.length > 0 && (
                <div className="debugWarnings">
                  <strong>Backend warnings</strong>
                  {debugWarnings.map((warning, index) => (
                    <p key={index}>{warning}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="panelBlock">
              <h2>Projection Logic</h2>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={invertMode}
                  onChange={(event) => setInvertMode(event.target.checked)}
                />
                Project around selected areas
              </label>
            </div>
          </aside>

          {stage}
        </section>
      )}

      {step === "content" && (
        <section className="workspace">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Projection Content</h2>

              <label className="fileButton">
                <Video size={18} />
                Upload Projection Video
                <input type="file" accept="video/*" onChange={handleVideoUpload} />
              </label>

              <button
                onClick={() => setProjectionContent("effect")}
                className={projectionContent === "effect" ? "activeEffect" : ""}
              >
                Use Built-in Animation
              </button>

              <button
                onClick={() => setProjectionContent("video")}
                disabled={!videoUrl}
                className={projectionContent === "video" ? "activeEffect" : ""}
              >
                Fill Surface With Video
              </button>
            </div>

            <div className="panelBlock">
              <h2>Built-in Effects</h2>

              <div className="effectList">
                {effects.map((effect) => (
                  <button
                    key={effect.id}
                    className={activeEffect === effect.id ? "activeEffect" : ""}
                    onClick={() => {
                      setActiveEffect(effect.id);
                      setProjectionContent("effect");
                    }}
                  >
                    {effect.name}
                    <span>{effect.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="primary"
              onClick={() => setProjectionOnly((value) => !value)}
            >
              {projectionOnly ? <EyeOff size={18} /> : <Eye size={18} />}
              {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}
            </button>
          </aside>

          {stage}
        </section>
      )}

      {step === "export" && (
        <section className="workspace">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>Export / Projector</h2>

              <button className="primary" onClick={() => setProjectionOnly(true)}>
                <Eye size={18} />
                Preview Projection Output
              </button>

              <button
                className="primary"
                onClick={openProjectorMode}
                disabled={!hasProject}
              >
                <Eye size={18} />
                Open Fullscreen Projector
              </button>

              <button
                className="primary"
                onClick={exportAlignmentGuide}
                disabled={!imageUrl}
              >
                <Download size={18} />
                Export Alignment Template
              </button>

              <button onClick={exportProjectFile} disabled={!hasProject}>
                <Save size={18} />
                Save Project File
              </button>

              <button onClick={() => importProjectRef.current?.click()}>
                <FolderOpen size={18} />
                Load Project File
              </button>

              <input
                ref={importProjectRef}
                className="hiddenInput"
                type="file"
                accept="application/json,.json"
                onChange={importProjectFile}
              />

              <p className="helperText">
                Fullscreen projector mode shows only animation/video output. The
                reference photo and setup boxes stay hidden.
              </p>
            </div>
          </aside>

          {stage}
        </section>
      )}
    </main>
  );
}
