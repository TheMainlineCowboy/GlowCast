import { useMemo, useRef, useState } from "react";
import { ImagePlus, Sparkles, ScanLine, Download, Plus, Trash2, Pencil, MousePointer2 } from "lucide-react";

type Zone = { id: number; x: number; y: number; width: number; height: number; included: boolean; label?: string; confidence?: number };
type Effect = { id: string; name: string; description: string };
type DraftZone = { startX: number; startY: number; currentX: number; currentY: number };
type ImageSize = { width: number; height: number };
type Box = { minX: number; minY: number; maxX: number; maxY: number; area: number; green: number; dark: number; sat: number; score?: number; label?: string };

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses, lightning flashes, and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow for holiday mapping" },
  { id: "neon", name: "Neon Glow", description: "Business sign or party-style electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement for dramatic projection" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const sat = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b) / 255; const mn = Math.min(r, g, b) / 255; return mx ? (mx - mn) / mx : 0; };
const dist = (r: number, g: number, b: number, t: number[]) => Math.hypot(r - t[0], g - t[1], b - t[2]);

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function normalizeDraftZone(d: DraftZone): Omit<Zone, "id" | "included"> {
  const x1 = clamp(Math.min(d.startX, d.currentX));
  const y1 = clamp(Math.min(d.startY, d.currentY));
  const x2 = clamp(Math.max(d.startX, d.currentX));
  const y2 = clamp(Math.max(d.startY, d.currentY));
  return { x: +x1.toFixed(2), y: +y1.toFixed(2), width: +(x2 - x1).toFixed(2), height: +(y2 - y1).toFixed(2) };
}

function wallColor(data: Uint8ClampedArray) {
  const buckets = new Map<string, number>();
  let best = "200,200,200";
  let bestCount = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const br = (r + g + b) / 3;
    if (br < 70 || br > 245 || sat(r, g, b) > .34) continue;
    const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
    const n = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, n);
    if (n > bestCount) { bestCount = n; best = key; }
  }
  return best.split(",").map(Number);
}

function classify(b: Box, w: number, h: number) {
  const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
  const centerY = (b.minY + b.maxY) / 2 / h;
  const greenRatio = b.green / Math.max(b.area, 1);
  const darkRatio = b.dark / Math.max(b.area, 1);
  if (greenRatio > .2 || centerY > .62 && b.sat / Math.max(b.area, 1) > .22) return "plant / landscaping";
  if (darkRatio > .28 && bw > w * .045 && bh > h * .055) return "window / dark opening";
  if (bh / Math.max(bw, 1) > 1.45 && bh > h * .22 && darkRatio < .55) return "door / tall object";
  if (centerY > .72 && bw > w * .12) return "ground object";
  return "mask suggestion";
}

function edgeTouch(b: Box, w: number, h: number) {
  return b.minX <= w * .025 || b.maxX >= w * .975 || b.minY <= h * .045 || b.maxY >= h * .975;
}

function componentBoxes(mask: Uint8Array, data: Uint8ClampedArray, w: number, h: number) {
  const seen = new Uint8Array(mask.length);
  const boxes: Box[] = [];
  const q: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    seen[i] = 1; q.length = 0; q.push(i);
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0, green = 0, dark = 0, satTotal = 0;
    while (q.length) {
      const pnt = q.pop() as number;
      const x = pnt % w, y = Math.floor(pnt / w), p = pnt * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2], br = (r + g + b) / 3, s = sat(r, g, b);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); area++;
      if (g - Math.max(r, b) > 8 || g > r && g > b && s > .15) green++;
      if (br < 118) dark++;
      satTotal += s;
      for (const n of [pnt - 1, pnt + 1, pnt - w, pnt + w]) {
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        if (Math.abs((n % w) - x) > 1) continue;
        seen[n] = 1; q.push(n);
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1, boxArea = bw * bh, total = w * h;
    if (area < 35 || bw < 5 || bh < 5 || boxArea > total * .28 || bw > w * .82 || bh > h * .75) continue;
    boxes.push({ minX, minY, maxX, maxY, area, green, dark, sat: satTotal });
  }
  return boxes;
}

function mergeBoxes(boxes: Box[], w: number, h: number) {
  const out: Box[] = [];
  boxes.forEach((box) => {
    let cur = box;
    let again = true;
    while (again) {
      again = false;
      const i = out.findIndex((b) => !(cur.maxX + w * .018 < b.minX || cur.minX - w * .018 > b.maxX || cur.maxY + h * .018 < b.minY || cur.minY - h * .018 > b.maxY));
      if (i >= 0) {
        const b = out.splice(i, 1)[0];
        cur = { minX: Math.min(cur.minX, b.minX), minY: Math.min(cur.minY, b.minY), maxX: Math.max(cur.maxX, b.maxX), maxY: Math.max(cur.maxY, b.maxY), area: cur.area + b.area, green: cur.green + b.green, dark: cur.dark + b.dark, sat: cur.sat + b.sat };
        again = true;
      }
    }
    out.push(cur);
  });
  return out;
}

export default function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 16, height: 9 });
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [activeEffect, setActiveEffect] = useState("haunt");
  const [invertMode, setInvertMode] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [draftZone, setDraftZone] = useState<DraftZone | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState("AI-assisted detection looks for windows, doors, plants, and objects to avoid or fill.");

  const selectedZone = useMemo(() => zones.find((z) => z.id === selectedZoneId) ?? null, [zones, selectedZoneId]);
  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;
  const effectClass = `effect-${activeEffect}`;
  const includedZones = zones.filter((z) => z.included);

  function getPoint(e: React.PointerEvent<HTMLDivElement>) {
    const s = surfaceRef.current;
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    setImageUrl(url);
    setImageSize({ width: img.naturalWidth || 16, height: img.naturalHeight || 9 });
    setZones([]);
    setSelectedZoneId(null);
    setDraftZone(null);
    setDrawMode(false);
    setDetectMessage("Photo loaded. Press AI Detect Mask Areas to find likely avoid/fill shapes.");
  }

  function addZone() {
    const id = Date.now();
    setZones((c) => [...c, { id, x: 18, y: 18, width: 24, height: 22, included: true, label: "manual zone" }]);
    setSelectedZoneId(id);
    setDrawMode(false);
  }

  async function detectMaskAreas() {
    if (!imageUrl) return;
    setDetecting(true);
    setDrawMode(false);
    setDetectMessage("Scanning photo surface only. Ignoring edge junk and looking for windows/plants/objects...");
    try {
      const img = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = Math.max(100, Math.round(img.naturalHeight * (320 / img.naturalWidth)));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bg = wallColor(data);
      const objectMask = new Uint8Array(canvas.width * canvas.height);
      const darkMask = new Uint8Array(canvas.width * canvas.height);
      const plantMask = new Uint8Array(canvas.width * canvas.height);

      for (let y = 2; y < canvas.height - 2; y++) for (let x = 2; x < canvas.width - 2; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const br = (r + g + b) / 3;
        const s = sat(r, g, b);
        const d = dist(r, g, b, bg);
        const green = g - Math.max(r, b) > 10 && s > .16;
        const dark = br < 118 && d > 20;
        const object = d > 55 || dark && d > 28 || green || s > .48;
        const index = y * canvas.width + x;
        if (object) objectMask[index] = 1;
        if (dark && y > canvas.height * .08 && y < canvas.height * .88) darkMask[index] = 1;
        if (green && y > canvas.height * .35) plantMask[index] = 1;
      }

      const raw = [...componentBoxes(darkMask, data, canvas.width, canvas.height), ...componentBoxes(plantMask, data, canvas.width, canvas.height), ...componentBoxes(objectMask, data, canvas.width, canvas.height)];
      const detected = mergeBoxes(raw, canvas.width, canvas.height)
        .map((b) => {
          const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
          const label = classify(b, canvas.width, canvas.height);
          const centerY = (b.minY + b.maxY) / 2 / canvas.height;
          const centerX = (b.minX + b.maxX) / 2 / canvas.width;
          const aspect = bw / Math.max(bh, 1);
          let score = b.area;
          if (label.includes("window")) score += 1600;
          if (label.includes("plant")) score += 1300;
          if (centerX > .18 && centerX < .82) score += 450;
          if (centerY > .14 && centerY < .9) score += 300;
          if (aspect > .45 && aspect < 2.6) score += 300;
          if (edgeTouch(b, canvas.width, canvas.height)) score -= 2600;
          if (b.minY < canvas.height * .08) score -= 1200;
          return { ...b, label, score };
        })
        .filter((b) => {
          const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1, area = bw * bh;
          if (area < 110 || area > canvas.width * canvas.height * .22) return false;
          if (edgeTouch(b, canvas.width, canvas.height) && !b.label?.includes("plant")) return false;
          if (b.minY < canvas.height * .08) return false;
          return true;
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 8);

      const next: Zone[] = detected.map((b, i) => {
        const px = canvas.width * .012, py = canvas.height * .012;
        const x1 = clamp(((b.minX - px) / canvas.width) * 100), y1 = clamp(((b.minY - py) / canvas.height) * 100);
        const x2 = clamp(((b.maxX + px) / canvas.width) * 100), y2 = clamp(((b.maxY + py) / canvas.height) * 100);
        return { id: Date.now() + i, x: +x1.toFixed(2), y: +y1.toFixed(2), width: +(x2 - x1).toFixed(2), height: +(y2 - y1).toFixed(2), included: true, label: b.label ?? "mask suggestion", confidence: Math.round(clamp(55 + ((b.score ?? 0) / 100), 55, 94)) };
      });

      setZones(next);
      setSelectedZoneId(next[0]?.id ?? null);
      setDetectMessage(next.length ? `Found ${next.length} suggested mask area${next.length === 1 ? "" : "s"}. Tap a box to include, exclude, resize, or delete it.` : "No strong mask areas found. Try a clearer, straighter photo or draw zones manually.");
    } catch {
      setDetectMessage("Detection failed on this image. Manual draw mode is still available.");
    } finally { setDetecting(false); }
  }

  function updateSelectedZone(updates: Partial<Zone>) { if (selectedZoneId) setZones((c) => c.map((z) => z.id === selectedZoneId ? { ...z, ...updates } : z)); }
  function deleteSelectedZone() { if (selectedZoneId) { setZones((c) => c.filter((z) => z.id !== selectedZoneId)); setSelectedZoneId(null); } }
  function down(e: React.PointerEvent<HTMLDivElement>) { if (!imageUrl || !drawMode || (e.target as HTMLElement).closest(".zone")) return; const p = getPoint(e); if (!p) return; e.currentTarget.setPointerCapture(e.pointerId); setSelectedZoneId(null); setDraftZone({ startX: p.x, startY: p.y, currentX: p.x, currentY: p.y }); }
  function move(e: React.PointerEvent<HTMLDivElement>) { if (!draftZone || !drawMode) return; const p = getPoint(e); if (p) setDraftZone((c) => c ? { ...c, currentX: p.x, currentY: p.y } : c); }
  function up() { if (!draftZone) return; const r = normalizeDraftZone(draftZone); setDraftZone(null); if (r.width < 2 || r.height < 2) return; const id = Date.now(); setZones((c) => [...c, { id, ...r, included: true, label: "manual zone" }]); setSelectedZoneId(id); }

  function exportAlignmentGuide() {
    const canvas = document.createElement("canvas"); canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    zones.forEach((z, i) => { const x = z.x / 100 * canvas.width, y = z.y / 100 * canvas.height, w = z.width / 100 * canvas.width, h = z.height / 100 * canvas.height; ctx.strokeStyle = z.included ? "#fef08a" : "#fb7185"; ctx.lineWidth = 8; ctx.strokeRect(x, y, w, h); ctx.fillStyle = "#fff"; ctx.font = "bold 48px Arial"; ctx.fillText(`${i + 1}`, x + 20, y + 60); });
    ctx.fillStyle = "#fff"; ctx.font = "bold 42px Arial"; ctx.fillText("GlowCast Alignment Guide", 40, canvas.height - 50);
    const link = document.createElement("a"); link.download = "glowcast-alignment-guide.png"; link.href = canvas.toDataURL("image/png"); link.click();
  }

  return <main className="appShell">
    <section className="heroPanel"><div><p className="eyebrow">GlowCast v0.3 Prototype</p><h1>AI-assisted masks that effects actually avoid.</h1><p className="subtitle">Upload a wall, house, garage, storefront, or stage photo. Detect windows, plants, doors, and objects, then project on them or around them.</p></div><label className="uploadButton"><ImagePlus size={20}/>Upload Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload}/></label></section>
    <section className="workspace"><aside className="toolPanel"><div className="panelBlock"><h2>1. Surface Setup</h2><button className="primary" onClick={detectMaskAreas} disabled={!imageUrl || detecting}><Sparkles size={18}/>{detecting ? "Detecting..." : "AI Detect Mask Areas"}</button><button onClick={() => setDrawMode(v => !v)} disabled={!imageUrl}>{drawMode ? <MousePointer2 size={18}/> : <Pencil size={18}/>} {drawMode ? "Drawing Mode On" : "Draw Zones"}</button><button onClick={addZone} disabled={!imageUrl}><Plus size={18}/>Add Manual Zone</button><p className="helperText">{drawMode ? "Drag directly on the photo to draw a mask zone." : detectMessage}</p></div><div className="panelBlock"><h2>2. Projection Logic</h2><label className="toggle"><input type="checkbox" checked={invertMode} onChange={e => setInvertMode(e.target.checked)}/>Project around selected areas</label><p className="helperText">{invertMode ? "Effect covers the surface but avoids included mask zones." : "Effect appears only inside included mask zones."}</p></div><div className="panelBlock"><h2>3. Effect</h2><div className="effectList">{effects.map(e => <button key={e.id} className={activeEffect === e.id ? "activeEffect" : ""} onClick={() => setActiveEffect(e.id)}>{e.name}<span>{e.description}</span></button>)}</div></div><div className="panelBlock"><h2>4. Export</h2><button className="primary" onClick={exportAlignmentGuide} disabled={!imageUrl}><Download size={18}/>Export Alignment Guide</button></div></aside>
    <section className="stageWrap"><div className="stage">{!imageUrl && <div className="emptyState"><ScanLine size={48}/><h2>Upload a surface photo to start.</h2><p>Start with a house, wall, garage door, window, storefront, or stage backdrop.</p></div>}{imageUrl && <div ref={surfaceRef} className={`surfaceLayer ${drawMode ? "drawMode" : ""}`} style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraftZone(null)}><img src={imageUrl} alt="Projection surface" draggable={false}/>{invertMode && <div className={`effectSurface ${effectClass}`}/>} {invertMode && includedZones.map(z => <div key={`cutout-${z.id}`} className="maskCutout" style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%`, backgroundImage: `url(${imageUrl})`, backgroundSize: `${10000 / z.width}% ${10000 / z.height}%`, backgroundPosition: `${z.x >= 100 - z.width ? 100 : z.x / (100 - z.width) * 100}% ${z.y >= 100 - z.height ? 100 : z.y / (100 - z.height) * 100}%` }}/>)} {!invertMode && includedZones.map(z => <div key={`fx-${z.id}`} className={`zoneEffect ${effectClass}`} style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%` }}/>) }{zones.map((z, i) => <button key={z.id} className={`zone ${z.included ? "included" : "excluded"} ${selectedZoneId === z.id ? "selected" : ""}`} style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%` }} onClick={e => { e.stopPropagation(); setSelectedZoneId(z.id); setDrawMode(false); }} title={z.label ?? "Mask zone"}><span>{i + 1}</span><em>{z.label}</em></button>)}{draftRect && <div className="draftZone" style={{ left: `${draftRect.x}%`, top: `${draftRect.y}%`, width: `${draftRect.width}%`, height: `${draftRect.height}%` }}/>}<div className="watermark">GlowCast Free Preview</div></div>}</div>{selectedZone && <div className="zoneEditor"><strong>Zone {zones.findIndex(z => z.id === selectedZone.id) + 1}</strong><label>X<input type="number" value={selectedZone.x} min={0} max={100} onChange={e => updateSelectedZone({ x: Number(e.target.value) })}/></label><label>Y<input type="number" value={selectedZone.y} min={0} max={100} onChange={e => updateSelectedZone({ y: Number(e.target.value) })}/></label><label>Width<input type="number" value={selectedZone.width} min={1} max={100} onChange={e => updateSelectedZone({ width: Number(e.target.value) })}/></label><label>Height<input type="number" value={selectedZone.height} min={1} max={100} onChange={e => updateSelectedZone({ height: Number(e.target.value) })}/></label><button onClick={() => updateSelectedZone({ included: !selectedZone.included })}>{selectedZone.included ? "Included" : "Excluded"}</button><button onClick={deleteSelectedZone}><Trash2 size={16}/>Delete</button></div>}</section></section>
  </main>;
}
