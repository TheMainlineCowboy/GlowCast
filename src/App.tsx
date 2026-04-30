import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Sparkles, ScanLine, Download, Plus, Trash2, Pencil, MousePointer2, Eye, EyeOff, Video, Save, FolderOpen } from "lucide-react";
import { detectSurfaceAndMasks, loadImage, type Zone } from "./detection";

type Effect = { id: string; name: string; description: string };
type DraftZone = { startX: number; startY: number; currentX: number; currentY: number };
type ImageSize = { width: number; height: number };
type ProjectionContent = "effect" | "video";
type Step = "start" | "mask" | "content" | "export";
type ResizeMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type EditTarget = "surface" | "zone";
type ResizeAction = { target: EditTarget; id: number; mode: ResizeMode; startX: number; startY: number; original: Zone };
type SavedProject = { id: string; name: string; savedAt: string; imageUrl: string | null; imageSize: ImageSize; surfaceZone: Zone | null; zones: Zone[]; activeEffect: string; invertMode: boolean; projectionContent: ProjectionContent; videoUrl: string | null; };

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses, lightning flashes, and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow for holiday mapping" },
  { id: "rain", name: "Rainfall", description: "Soft rain streaks that respect avoid masks" },
  { id: "neon", name: "Neon Glow", description: "Business sign or party-style electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement for dramatic projection" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

const handles: ResizeMode[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const RECENT_PROJECTS_KEY = "glowcast-recent-projects";
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const toStyle = (zone: Pick<Zone, "x" | "y" | "width" | "height">) => ({ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` });
const defaultSurface = (): Zone => ({ id: -1, x: 8, y: 14, width: 84, height: 72, included: true, label: "projection surface" });

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
  try { return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || "[]") as SavedProject[]; } catch { return []; }
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const importProjectRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 16, height: 9 });
  const [surfaceZone, setSurfaceZone] = useState<Zone | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<EditTarget>("surface");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
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

  const projectionArea = surfaceZone ?? defaultSurface();
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [zones, selectedZoneId]);
  const selectedEditable = selectedTarget === "surface" ? projectionArea : selectedZone;
  const includedZones = zones.filter((zone) => zone.included);
  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;
  const effectClass = `effect-${activeEffect}`;
  const hasProject = Boolean(imageUrl || surfaceZone || zones.length || videoUrl);

  useEffect(() => setRecentProjects(getRecentProjects()), []);
  useEffect(() => {
    const onFullscreenChange = () => { if (!document.fullscreenElement) setProjectorMode(false); };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => {
    if (!hasProject) return;
    const timeout = window.setTimeout(() => {
      const project: SavedProject = { id: String(Date.now()), name: `GlowCast Project ${new Date().toLocaleString()}`, savedAt: new Date().toISOString(), imageUrl, imageSize, surfaceZone, zones, activeEffect, invertMode, projectionContent, videoUrl };
      const recent = [project, ...getRecentProjects()].slice(0, 5);
      try { localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent)); setRecentProjects(recent); } catch {}
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [imageUrl, imageSize, surfaceZone, zones, activeEffect, invertMode, projectionContent, videoUrl, hasProject]);

  function getPoint(event: React.PointerEvent<HTMLElement>) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) };
  }

  function loadProject(project: SavedProject) {
    setImageUrl(project.imageUrl ?? null);
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
    setStep("mask");
    setDetectMessage("Project loaded. Tap the surface or a mask to edit it.");
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    setImageUrl(dataUrl);
    setImageSize({ width: image.naturalWidth || 16, height: image.naturalHeight || 9 });
    setSurfaceZone(defaultSurface());
    setZones([]);
    setSelectedTarget("surface");
    setSelectedZoneId(null);
    setDraftZone(null);
    setResizeAction(null);
    setDrawMode(false);
    setProjectionOnly(false);
    setStep("mask");
    setDetectMessage("Photo loaded. Detect surface/masks or drag the surface handles manually.");
  }

  async function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setVideoUrl(dataUrl);
    setProjectionContent("video");
    setProjectionOnly(true);
    setDetectMessage("Projection video loaded. Preview output without the reference photo.");
  }

  async function detectMaskAreas() {
    if (!imageUrl) return;
    setDetecting(true);
    setDrawMode(false);
    setProjectionOnly(false);
    setDetectMessage("Detecting projection surface separately from avoid masks...");
    try {
      const result = await detectSurfaceAndMasks(imageUrl);
      setSurfaceZone(result.surface ?? defaultSurface());
      setZones(result.masks);
      setSelectedTarget("surface");
      setSelectedZoneId(null);
      setDetectMessage(`Detected projection surface and ${result.masks.length} avoid mask${result.masks.length === 1 ? "" : "s"}. Tap the surface or any mask to correct it.`);
    } catch {
      setDetectMessage("Detection failed. Use manual surface and avoid-zone editing.");
    } finally { setDetecting(false); }
  }

  function updateSurface(updates: Partial<Zone>) {
    setSurfaceZone((current) => ({ ...(current ?? defaultSurface()), ...updates, id: -1, included: true, label: "projection surface" }));
  }

  function addZone() {
    const id = Date.now();
    setZones((current) => [...current, { id, x: 18, y: 18, width: 24, height: 22, included: true, label: "manual avoid zone" }]);
    setSelectedTarget("zone");
    setSelectedZoneId(id);
    setDrawMode(false);
    setProjectionOnly(false);
  }

  function updateSelectedZone(updates: Partial<Zone>) {
    if (!selectedZoneId) return;
    setZones((current) => current.map((zone) => zone.id === selectedZoneId ? { ...zone, ...updates } : zone));
  }

  function updateSelectedEditable(updates: Partial<Zone>) {
    if (selectedTarget === "surface") updateSurface(updates);
    else updateSelectedZone(updates);
  }

  function deleteSelectedZone() {
    if (!selectedZoneId) return;
    setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
    setSelectedTarget("surface");
    setSelectedZoneId(null);
  }

  function applyResize(action: ResizeAction, point: { x: number; y: number }) {
    const dx = point.x - action.startX;
    const dy = point.y - action.startY;
    const original = action.original;
    let x = original.x;
    let y = original.y;
    let width = original.width;
    let height = original.height;
    if (action.mode === "move") { x += dx; y += dy; }
    if (action.mode.includes("e")) width += dx;
    if (action.mode.includes("s")) height += dy;
    if (action.mode.includes("w")) { x += dx; width -= dx; }
    if (action.mode.includes("n")) { y += dy; height -= dy; }
    width = Math.max(2, width);
    height = Math.max(2, height);
    x = clamp(x, 0, 100 - width);
    y = clamp(y, 0, 100 - height);
    const updated = { x: +x.toFixed(2), y: +y.toFixed(2), width: +width.toFixed(2), height: +height.toFixed(2) };
    if (action.target === "surface") updateSurface(updated);
    else setZones((current) => current.map((zone) => zone.id === action.id ? { ...zone, ...updated } : zone));
  }

  function startResize(event: React.PointerEvent<HTMLElement>, target: EditTarget, zone: Zone, mode: ResizeMode) {
    const point = getPoint(event);
    if (!point) return;
    event.stopPropagation();
    setSelectedTarget(target);
    setSelectedZoneId(target === "zone" ? zone.id : null);
    setDrawMode(false);
    setProjectionOnly(false);
    setResizeAction({ target, id: zone.id, mode, startX: point.x, startY: point.y, original: { ...zone } });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeAction) return;
    if (!imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone,.projectionBoundary")) return;
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTarget("zone");
    setSelectedZoneId(null);
    setDraftZone({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = getPoint(event);
    if (!point) return;
    if (resizeAction) { applyResize(resizeAction, point); return; }
    if (!draftZone || !drawMode || projectionOnly) return;
    setDraftZone((current) => current ? { ...current, currentX: point.x, currentY: point.y } : current);
  }

  function finishPointerAction() {
    setResizeAction(null);
    if (!draftZone) return;
    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);
    if (rect.width < 2 || rect.height < 2) return;
    const id = Date.now();
    setZones((current) => [...current, { id, ...rect, included: true, label: "manual avoid zone" }]);
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
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }

  function exportProjectFile() {
    const project: SavedProject = { id: String(Date.now()), name: `GlowCast Project ${new Date().toLocaleString()}`, savedAt: new Date().toISOString(), imageUrl, imageSize, surfaceZone, zones, activeEffect, invertMode, projectionContent, videoUrl };
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
    try { loadProject(JSON.parse(await file.text()) as SavedProject); } catch { setDetectMessage("Could not load that project file."); } finally { event.target.value = ""; }
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
    if (projectionContent === "video" && videoUrl) return <video className={`projectionVideo ${extraClass}`} src={videoUrl} autoPlay muted loop playsInline />;
    return <div className={`effectFill ${effectClass} ${extraClass}`} />;
  }

  function renderHandles(target: EditTarget, zone: Zone) {
    const selected = selectedTarget === target && (target === "surface" || selectedZoneId === zone.id);
    if (!selected || projectionOnly) return null;
    return handles.map((handle) => <i key={handle} className={`resizeHandle handle-${handle}`} onPointerDown={(event) => startResize(event, target, zone, handle)} />);
  }

  if (projectorMode) {
    return <main className="projectorShell">
      <button className="projectorExit" onClick={closeProjectorMode}>Exit Projector</button>
      <div className="projectorCanvas" style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }}>
        {invertMode && <div className="projectionSurface" style={toStyle(projectionArea)}>{renderProjectionLayer("projectorEffect")}</div>}
        {invertMode && includedZones.map((zone) => <div key={`projector-cutout-${zone.id}`} className="projectorMaskCutout" style={toStyle(zone)} />)}
        {!invertMode && includedZones.map((zone) => <div key={`projector-fx-${zone.id}`} className="zoneProjection" style={toStyle(zone)}>{renderProjectionLayer("projectorEffect")}</div>)}
      </div>
    </main>;
  }

  const stage = <section className="stageWrap">
    <div className={`stage ${projectionOnly ? "projectionOnly" : ""}`}>
      {!imageUrl && !videoUrl && <div className="emptyState"><ScanLine size={48}/><h2>No project loaded yet.</h2><p>Upload a reference photo from the Start page.</p></div>}
      {(imageUrl || videoUrl) && <div ref={surfaceRef} className={`surfaceLayer ${drawMode ? "drawMode" : ""}`} style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointerAction} onPointerCancel={finishPointerAction}>
        {imageUrl && <img className="referencePhoto" src={imageUrl} alt="Projection surface" draggable={false}/>} 
        {!projectionOnly && <div className={`projectionBoundary ${selectedTarget === "surface" ? "selectedSurface" : ""}`} style={toStyle(projectionArea)} onPointerDown={(event) => startResize(event, "surface", projectionArea, "move")}><b>surface</b>{renderHandles("surface", projectionArea)}</div>}
        {invertMode && <div className="projectionSurface" style={toStyle(projectionArea)}>{renderProjectionLayer()}</div>}
        {invertMode && includedZones.map((zone) => <div key={`cutout-${zone.id}`} className="maskCutout" style={{ ...toStyle(zone), backgroundImage: projectionOnly || !imageUrl ? "none" : `url(${imageUrl})`, backgroundSize: `${10000 / zone.width}% ${10000 / zone.height}%`, backgroundPosition: `${zone.x >= 100 - zone.width ? 100 : zone.x / (100 - zone.width) * 100}% ${zone.y >= 100 - zone.height ? 100 : zone.y / (100 - zone.height) * 100}%` }}/>) }
        {!invertMode && includedZones.map((zone) => <div key={`fx-${zone.id}`} className="zoneProjection" style={toStyle(zone)}>{renderProjectionLayer()}</div>) }
        {!projectionOnly && zones.map((zone, index) => <div key={zone.id} className={`zone ${zone.included ? "included" : "excluded"} ${selectedTarget === "zone" && selectedZoneId === zone.id ? "selected" : ""}`} style={toStyle(zone)} onPointerDown={(event) => startResize(event, "zone", zone, "move")} title={zone.label ?? "Mask zone"}><span>{index + 1}</span>{renderHandles("zone", zone)}</div>)}
        {draftRect && !projectionOnly && <div className="draftZone" style={toStyle(draftRect)}/>} 
      </div>}
    </div>
    {selectedEditable && !projectionOnly && <div className="zoneEditor">
      <strong>{selectedTarget === "surface" ? "Projection Surface" : `Zone ${zones.findIndex((zone) => zone.id === selectedZoneId) + 1}`}</strong>
      <label>X<input type="number" value={selectedEditable.x} min={0} max={100} onChange={(event) => updateSelectedEditable({ x: Number(event.target.value) })}/></label>
      <label>Y<input type="number" value={selectedEditable.y} min={0} max={100} onChange={(event) => updateSelectedEditable({ y: Number(event.target.value) })}/></label>
      <label>Width<input type="number" value={selectedEditable.width} min={1} max={100} onChange={(event) => updateSelectedEditable({ width: Number(event.target.value) })}/></label>
      <label>Height<input type="number" value={selectedEditable.height} min={1} max={100} onChange={(event) => updateSelectedEditable({ height: Number(event.target.value) })}/></label>
      {selectedTarget === "zone" && <button onClick={() => updateSelectedZone({ included: !selectedZone?.included })}>{selectedZone?.included ? "Included" : "Excluded"}</button>}
      {selectedTarget === "zone" && <button onClick={deleteSelectedZone}><Trash2 size={16}/>Delete</button>}
    </div>}
  </section>;

  return <main className="appShell">
    <section className="heroPanel"><div><p className="eyebrow">GlowCast MVP Prototype</p><h1>{step === "start" ? "Start a projection map." : step === "mask" ? "Mask and edit the surface." : step === "content" ? "Choose what projects." : "Export or play it."}</h1><p className="subtitle">Reference photos stay in setup. Projection preview shows only animation or video through your masks.</p></div></section>
    <nav className="stepNav"><button className={step === "start" ? "activeStep" : ""} onClick={() => setStep("start")}>1 Start</button><button className={step === "mask" ? "activeStep" : ""} onClick={() => setStep("mask")} disabled={!hasProject}>2 Mask & Edit</button><button className={step === "content" ? "activeStep" : ""} onClick={() => setStep("content")} disabled={!hasProject}>3 Content</button><button className={step === "export" ? "activeStep" : ""} onClick={() => setStep("export")} disabled={!hasProject}>4 Export</button></nav>
    {step === "start" && <section className="startPage"><div className="startCard"><h2>Start with a reference photo</h2><p>The photo is only for setup and alignment. The actual projection output will be animation or uploaded video only.</p><label className="uploadButton"><ImagePlus size={20}/>Upload Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload}/></label><button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18}/>Load Project File</button><input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile}/></div><div className="startCard"><h2>Recent autosaves</h2>{recentProjects.length === 0 && <p className="helperText">No recent projects saved in this browser yet.</p>}{recentProjects.map((project) => <button key={project.id} onClick={() => loadProject(project)}><FolderOpen size={18}/>{project.name}</button>)}</div></section>}
    {step === "mask" && <section className="workspace"><aside className="toolPanel"><div className="panelBlock"><h2>Surface + Masks</h2><button className="primary" onClick={detectMaskAreas} disabled={!imageUrl || detecting}><Sparkles size={18}/>{detecting ? "Detecting..." : "AI Detect Surface + Masks"}</button><button onClick={() => { setDrawMode((value) => !value); setProjectionOnly(false); }} disabled={!imageUrl}>{drawMode ? <MousePointer2 size={18}/> : <Pencil size={18}/>} {drawMode ? "Drawing Mode On" : "Draw Avoid Zone"}</button><button onClick={addZone} disabled={!imageUrl}><Plus size={18}/>Add Manual Avoid Zone</button><button className="primary" onClick={() => setProjectionOnly((value) => !value)} disabled={!hasProject}>{projectionOnly ? <EyeOff size={18}/> : <Eye size={18}/>} {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}</button><p className="helperText">{drawMode ? "Drag directly on the photo to draw an avoid mask." : detectMessage}</p></div><div className="panelBlock"><h2>Projection Logic</h2><label className="toggle"><input type="checkbox" checked={invertMode} onChange={(event) => setInvertMode(event.target.checked)}/>Project around selected areas</label></div></aside>{stage}</section>}
    {step === "content" && <section className="workspace"><aside className="toolPanel"><div className="panelBlock"><h2>Projection Content</h2><label className="fileButton"><Video size={18}/>Upload Projection Video<input type="file" accept="video/*" onChange={handleVideoUpload}/></label><button onClick={() => setProjectionContent("effect")} className={projectionContent === "effect" ? "activeEffect" : ""}>Use Built-in Animation</button><button onClick={() => setProjectionContent("video")} disabled={!videoUrl} className={projectionContent === "video" ? "activeEffect" : ""}>Fill Surface With Video</button></div><div className="panelBlock"><h2>Built-in Effects</h2><div className="effectList">{effects.map((effect) => <button key={effect.id} className={activeEffect === effect.id ? "activeEffect" : ""} onClick={() => { setActiveEffect(effect.id); setProjectionContent("effect"); }}>{effect.name}<span>{effect.description}</span></button>)}</div></div><button className="primary" onClick={() => setProjectionOnly((value) => !value)}>{projectionOnly ? <EyeOff size={18}/> : <Eye size={18}/>} {projectionOnly ? "Show Setup Layers" : "Preview Animation Only"}</button></aside>{stage}</section>}
    {step === "export" && <section className="workspace"><aside className="toolPanel"><div className="panelBlock"><h2>Export / Projector</h2><button className="primary" onClick={() => setProjectionOnly(true)}><Eye size={18}/>Preview Projection Output</button><button className="primary" onClick={openProjectorMode} disabled={!hasProject}><Eye size={18}/>Open Fullscreen Projector</button><button className="primary" onClick={exportAlignmentGuide} disabled={!imageUrl}><Download size={18}/>Export Alignment Template</button><button onClick={exportProjectFile} disabled={!hasProject}><Save size={18}/>Save Project File</button><button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18}/>Load Project File</button><input ref={importProjectRef} className="hiddenInput" type="file" accept="application/json,.json" onChange={importProjectFile}/><p className="helperText">Fullscreen projector mode shows only animation/video output. The reference photo and setup boxes stay hidden.</p></div></aside>{stage}</section>}
  </main>;
}
