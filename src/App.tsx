import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Sparkles, ScanLine, Download, Plus, Trash2, Pencil, MousePointer2, Eye, EyeOff, Video, Save, FolderOpen } from "lucide-react";
import { detectSurfaceAndMasks, loadImage, type Zone } from "./detection";

type Effect = { id: string; name: string; description: string };
type DraftZone = { startX: number; startY: number; currentX: number; currentY: number };
type ImageSize = { width: number; height: number };
type ProjectionContent = "effect" | "video";

type SavedProject = {
  id: string;
  name: string;
  savedAt: string;
  imageUrl: string | null;
  imageSize: ImageSize;
  surfaceZone: Zone | null;
  zones: Zone[];
  activeEffect: string;
  invertMode: boolean;
  projectionContent: ProjectionContent;
  videoUrl: string | null;
};

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses, lightning flashes, and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow for holiday mapping" },
  { id: "rain", name: "Rainfall", description: "Soft rain streaks that respect avoid masks" },
  { id: "neon", name: "Neon Glow", description: "Business sign or party-style electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement for dramatic projection" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` });
const RECENT_PROJECTS_KEY = "glowcast-recent-projects";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeDraftZone(draft: DraftZone): Omit<Zone, "id" | "included"> {
  const x1 = clamp(Math.min(draft.startX, draft.currentX));
  const y1 = clamp(Math.min(draft.startY, draft.currentY));
  const x2 = clamp(Math.max(draft.startX, draft.currentX));
  const y2 = clamp(Math.max(draft.startY, draft.currentY));
  return { x: +x1.toFixed(2), y: +y1.toFixed(2), width: +(x2 - x1).toFixed(2), height: +(y2 - y1).toFixed(2) };
}

function getRecentProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || "[]") as SavedProject[];
  } catch {
    return [];
  }
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const importProjectRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 16, height: 9 });
  const [surfaceZone, setSurfaceZone] = useState<Zone | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [activeEffect, setActiveEffect] = useState("snow");
  const [projectionContent, setProjectionContent] = useState<ProjectionContent>("effect");
  const [invertMode, setInvertMode] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [projectionOnly, setProjectionOnly] = useState(false);
  const [draftZone, setDraftZone] = useState<DraftZone | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState("AI detection suggests a surface and masks. Manual cleanup is still the real safety net.");

  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [zones, selectedZoneId]);
  const includedZones = zones.filter((zone) => zone.included);
  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;
  const effectClass = `effect-${activeEffect}`;
  const projectionArea: Zone = surfaceZone ?? { id: -1, x: 0, y: 0, width: 100, height: 100, included: true, label: "projection surface" };
  const hasProject = Boolean(imageUrl || surfaceZone || zones.length || videoUrl);

  useEffect(() => {
    if (!hasProject) return;

    const timeout = window.setTimeout(() => {
      const project: SavedProject = {
        id: String(Date.now()),
        name: `GlowCast Project ${new Date().toLocaleString()}`,
        savedAt: new Date().toISOString(),
        imageUrl,
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
      } catch {
        // Large video/image projects may exceed browser storage; manual project export still works when possible.
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [imageUrl, imageSize, surfaceZone, zones, activeEffect, invertMode, projectionContent, videoUrl, hasProject]);

  function getPoint(event: React.PointerEvent<HTMLDivElement>) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) };
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    setImageUrl(dataUrl);
    setImageSize({ width: image.naturalWidth || 16, height: image.naturalHeight || 9 });
    setSurfaceZone(null);
    setZones([]);
    setSelectedZoneId(null);
    setDraftZone(null);
    setDrawMode(false);
    setProjectionOnly(false);
    setDetectMessage("Photo loaded. Press AI Detect Surface + Masks, then use Manual Cleanup if needed.");
  }

  async function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setVideoUrl(dataUrl);
    setProjectionContent("video");
    setDetectMessage("Projection video loaded. Use Preview Animation Only to see video output without the reference photo.");
  }

  async function detectMaskAreas() {
    if (!imageUrl) return;
    setDetecting(true);
    setDrawMode(false);
    setProjectionOnly(false);
    setDetectMessage("Detecting projection surface separately from avoid masks...");
    try {
      const result = await detectSurfaceAndMasks(imageUrl);
      setSurfaceZone(result.surface);
      setZones(result.masks);
      setSelectedZoneId(result.masks[0]?.id ?? null);
      setDetectMessage(`Detected projection surface${result.masks.length ? ` and ${result.masks.length} avoid mask${result.masks.length === 1 ? "" : "s"}` : ""}. Use Manual Cleanup to fix anything wrong.`);
    } catch {
      setDetectMessage("Detection failed on this image. Draw the surface/masks manually.");
    } finally {
      setDetecting(false);
    }
  }

  function addZone() {
    const id = Date.now();
    setZones((current) => [...current, { id, x: 18, y: 18, width: 24, height: 22, included: true, label: "manual avoid zone" }]);
    setSelectedZoneId(id);
    setDrawMode(false);
    setProjectionOnly(false);
  }

  function updateSelectedZone(updates: Partial<Zone>) {
    if (!selectedZoneId) return;
    setZones((current) => current.map((zone) => zone.id === selectedZoneId ? { ...zone, ...updates } : zone));
  }

  function deleteSelectedZone() {
    if (!selectedZoneId) return;
    setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
    setSelectedZoneId(null);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone")) return;
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedZoneId(null);
    setDraftZone({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draftZone || !drawMode || projectionOnly) return;
    const point = getPoint(event);
    if (!point) return;
    setDraftZone((current) => current ? { ...current, currentX: point.x, currentY: point.y } : current);
  }

  function finishDrawingZone() {
    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);
    if (rect.width < 2 || rect.height < 2) return;
    const id = Date.now();
    setZones((current) => [...current, { id, ...rect, included: true, label: "manual avoid zone" }]);
    setSelectedZoneId(id);
  }

  function exportProjectFile() {
    const project: SavedProject = {
      id: String(Date.now()),
      name: `GlowCast Project ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      imageUrl,
      imageSize,
      surfaceZone,
      zones,
      activeEffect,
      invertMode,
      projectionContent,
      videoUrl
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = "glowcast-project.json";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importProjectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = JSON.parse(text) as SavedProject;
      setImageUrl(project.imageUrl ?? null);
      setVideoUrl(project.videoUrl ?? null);
      setImageSize(project.imageSize ?? { width: 16, height: 9 });
      setSurfaceZone(project.surfaceZone ?? null);
      setZones(project.zones ?? []);
      setSelectedZoneId(project.zones?.[0]?.id ?? null);
      setActiveEffect(project.activeEffect ?? "snow");
      setInvertMode(project.invertMode ?? true);
      setProjectionContent(project.projectionContent ?? "effect");
      setProjectionOnly(false);
      setDetectMessage("Project file loaded. Continue editing or preview animation-only output.");
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
    for (let x = 0; x <= canvas.width; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 10;
    ctx.strokeRect(projectionArea.x / 100 * canvas.width, projectionArea.y / 100 * canvas.height, projectionArea.width / 100 * canvas.width, projectionArea.height / 100 * canvas.height);
    zones.forEach((zone, index) => {
      const x = zone.x / 100 * canvas.width;
      const y = zone.y / 100 * canvas.height;
      const w = zone.width / 100 * canvas.width;
      const h = zone.height / 100 * canvas.height;
      ctx.strokeStyle = zone.included ? "#fef08a" : "#fb7185";
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px Arial";
      ctx.fillText(`${index + 1}`, x + 20, y + 60);
    });
    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px Arial";
    ctx.fillText("GlowCast Alignment Guide", 40, canvas.height - 50);
    const link = document.createElement("a");
    link.download = "glowcast-alignment-guide.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function renderProjectionLayer(extraClass = "") {
    if (projectionContent === "video" && videoUrl) {
      return <video className={`projectionVideo ${extraClass}`} src={videoUrl} autoPlay muted loop playsInline />;
    }
    return <div className={`effectFill ${effectClass} ${extraClass}`} />;
  }

  return <main className="appShell">
    <section className="heroPanel">
      <div><p className="eyebrow">GlowCast MVP Prototype</p><h1>Set up with a photo. Project only the animation.</h1><p className="subtitle">Use the photo as a reference, then preview or play only the masked animation/video output.</p></div>
      <label className="uploadButton"><ImagePlus size={20}/>Upload Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload}/></label>
    </section>
    <section className="workspace">
      <aside className="toolPanel">
        <div className="panelBlock"><h2>1. Surface Setup</h2><button className="primary" onClick={detectMaskAreas} disabled={!imageUrl || detecting}><Sparkles size={18}/>{detecting ? "Detecting..." : "AI Detect Surface + Masks"}</button><button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); }} disabled={!imageUrl}>{drawMode ? <MousePointer2 size={18}/> : <Pencil size={18}/>} {drawMode ? "Drawing Mode On" : "Draw Avoid Zone"}</button><button onClick={addZone} disabled={!imageUrl}><Plus size={18}/>Add Manual Avoid Zone</button><p className="helperText">{drawMode ? "Drag directly on the photo to draw an avoid mask." : detectMessage}</p></div>
        <div className="panelBlock"><h2>2. Projection Content</h2><label className="fileButton"><Video size={18}/>Upload Projection Video<input type="file" accept="video/*" onChange={handleVideoUpload}/></label><button onClick={() => setProjectionContent("effect")} className={projectionContent === "effect" ? "activeEffect" : ""}>Use Built-in Animation</button><button onClick={() => setProjectionContent("video")} disabled={!videoUrl} className={projectionContent === "video" ? "activeEffect" : ""}>Fill Surface With Video</button></div>
        <div className="panelBlock"><h2>3. Projection Logic</h2><button className="primary" onClick={() => setProjectionOnly((value) => !value)} disabled={!imageUrl && !videoUrl}>{projectionOnly ? <EyeOff size={18}/> : <Eye size={18}/>} {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}</button><label className="toggle"><input type="checkbox" checked={invertMode} onChange={(event) => setInvertMode(event.target.checked)}/>Project around selected areas</label><p className="helperText">{invertMode ? "Projection fills the surface and avoids included masks." : "Projection appears only inside included mask zones."}</p></div>
        <div className="panelBlock"><h2>4. Effect</h2><div className="effectList">{effects.map((effect) => <button key={effect.id} className={activeEffect === effect.id ? "activeEffect" : ""} onClick={() => { setActiveEffect(effect.id); setProjectionContent("effect"); }}>{effect.name}<span>{effect.description}</span></button>)}</div></div>
        <div className="panelBlock"><h2>5. Save / Export</h2><button className="primary" onClick={exportAlignmentGuide} disabled={!imageUrl}><Download size={18}/>Export Alignment Template</button><button onClick={exportProjectFile} disabled={!hasProject}><Save size={18}/>Save Project File</button><button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18}/>Load Project File</button><input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile}/><p className="helperText">Recent projects autosave locally. Video export/fullscreen projection engine comes next.</p></div>
      </aside>
      <section className="stageWrap"><div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>{!imageUrl && !videoUrl && <div className="emptyState"><ScanLine size={48}/><h2>Upload a surface photo to start.</h2><p>The photo is only for setup. Final output is animation/video only.</p></div>}{(imageUrl || videoUrl) && <div ref={surfaceRef} className={`surfaceLayer ${drawMode ? "drawMode" : ""}`} style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrawingZone} onPointerCancel={() => setDraftZone(null)}>{imageUrl && <img className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false}/>} {surfaceZone && !projectionOnly && <div className="projectionBoundary" style={toStyle(surfaceZone)}><b>surface</b></div>}{invertMode && <div className="projectionSurface" style={toStyle(projectionArea)}>{renderProjectionLayer()}</div>} {invertMode && includedZones.map((zone) => <div key={`cutout-${zone.id}`} className="maskCutout" style={{ ...toStyle(zone), backgroundImage: projectionOnly || !imageUrl ? "none" : `url(${imageUrl})`, backgroundSize: `${10000 / zone.width}% ${10000 / zone.height}%`, backgroundPosition: `${zone.x >= 100 - zone.width ? 100 : zone.x / (100 - zone.width) * 100}% ${zone.y >= 100 - zone.height ? 100 : zone.y / (100 - zone.height) * 100}%` }}/>) } {!invertMode && includedZones.map((zone) => <div key={`fx-${zone.id}`} className="zoneProjection" style={toStyle(zone)}>{renderProjectionLayer()}</div>) }{!projectionOnly && zones.map((zone, index) => <button key={zone.id} className={`zone ${zone.included ? "included" : "excluded"} ${selectedZoneId === zone.id ? "selected" : ""}`} style={toStyle(zone)} onClick={(event) => { event.stopPropagation(); setSelectedZoneId(zone.id); setDrawMode(false); }} title={zone.label ?? "Mask zone"}><span>{index + 1}</span></button>)}{draftRect && !projectionOnly && <div className="draftZone" style={toStyle(draftRect)}/>}</div>}</div>{selectedZone && !projectionOnly && <div className="zoneEditor"><strong>Zone {zones.findIndex((zone) => zone.id === selectedZone.id) + 1}</strong><label>X<input type="number" value={selectedZone.x} min={0} max={100} onChange={(event) => updateSelectedZone({ x: Number(event.target.value) })}/></label><label>Y<input type="number" value={selectedZone.y} min={0} max={100} onChange={(event) => updateSelectedZone({ y: Number(event.target.value) })}/></label><label>Width<input type="number" value={selectedZone.width} min={1} max={100} onChange={(event) => updateSelectedZone({ width: Number(event.target.value) })}/></label><label>Height<input type="number" value={selectedZone.height} min={1} max={100} onChange={(event) => updateSelectedZone({ height: Number(event.target.value) })}/></label><button onClick={() => updateSelectedZone({ included: !selectedZone.included })}>{selectedZone.included ? "Included" : "Excluded"}</button><button onClick={deleteSelectedZone}><Trash2 size={16}/>Delete</button></div>}</section>
    </section>
  </main>;
}
