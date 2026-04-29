import { useMemo, useRef, useState } from "react";
import { ImagePlus, Sparkles, ScanLine, Download, Plus, Trash2, Pencil, MousePointer2 } from "lucide-react";

type Zone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
};

type Effect = {
  id: string;
  name: string;
  description: string;
};

type DraftZone = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const effects: Effect[] = [
  { id: "haunt", name: "Haunted Windows", description: "Ghostly pulses, lightning flashes, and eerie glow" },
  { id: "snow", name: "Snowfall", description: "Soft falling snow for holiday mapping" },
  { id: "neon", name: "Neon Glow", description: "Business sign or party-style electric glow" },
  { id: "fire", name: "Fire Glow", description: "Warm flame movement for dramatic projection" },
  { id: "grid", name: "Alignment Grid", description: "Useful for lining up the projector" }
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDraftZone(draft: DraftZone): Omit<Zone, "id" | "included"> {
  const x1 = clamp(Math.min(draft.startX, draft.currentX));
  const y1 = clamp(Math.min(draft.startY, draft.currentY));
  const x2 = clamp(Math.max(draft.startX, draft.currentX));
  const y2 = clamp(Math.max(draft.startY, draft.currentY));

  return {
    x: Number(x1.toFixed(2)),
    y: Number(y1.toFixed(2)),
    width: Number((x2 - x1).toFixed(2)),
    height: Number((y2 - y1).toFixed(2))
  };
}

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [activeEffect, setActiveEffect] = useState("haunt");
  const [invertMode, setInvertMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [draftZone, setDraftZone] = useState<DraftZone | null>(null);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [zones, selectedZoneId]
  );

  const activeEffectClass = `effect-${activeEffect}`;
  const draftRect = draftZone ? normalizeDraftZone(draftZone) : null;

  function getStagePoint(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return null;

    const rect = stage.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100);

    return { x, y };
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setZones([]);
    setSelectedZoneId(null);
    setDraftZone(null);
    setDrawMode(true);
  }

  function addZone() {
    const nextId = Date.now();
    const newZone: Zone = {
      id: nextId,
      x: 18,
      y: 18,
      width: 24,
      height: 22,
      included: true
    };

    setZones((current) => [...current, newZone]);
    setSelectedZoneId(nextId);
    setDrawMode(false);
  }

  function addDummyAiZones() {
    const aiZones: Zone[] = [
      { id: Date.now() + 1, x: 12, y: 20, width: 18, height: 24, included: true },
      { id: Date.now() + 2, x: 42, y: 18, width: 18, height: 25, included: true },
      { id: Date.now() + 3, x: 70, y: 24, width: 16, height: 22, included: false }
    ];

    setZones(aiZones);
    setSelectedZoneId(aiZones[0].id);
    setDrawMode(false);
  }

  function updateSelectedZone(updates: Partial<Zone>) {
    if (!selectedZoneId) return;

    setZones((current) =>
      current.map((zone) =>
        zone.id === selectedZoneId ? { ...zone, ...updates } : zone
      )
    );
  }

  function deleteSelectedZone() {
    if (!selectedZoneId) return;

    setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
    setSelectedZoneId(null);
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageUrl || !drawMode) return;
    if ((event.target as HTMLElement).closest(".zone")) return;

    const point = getStagePoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedZoneId(null);
    setDraftZone({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draftZone || !drawMode) return;

    const point = getStagePoint(event);
    if (!point) return;

    setDraftZone((current) =>
      current ? { ...current, currentX: point.x, currentY: point.y } : current
    );
  }

  function finishDrawingZone() {
    if (!draftZone) return;

    const rect = normalizeDraftZone(draftZone);
    setDraftZone(null);

    if (rect.width < 2 || rect.height < 2) return;

    const nextId = Date.now();
    setZones((current) => [...current, { id: nextId, ...rect, included: true }]);
    setSelectedZoneId(nextId);
  }

  function exportAlignmentGuide() {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#020617";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#22d3ee";
    context.lineWidth = 2;

    for (let x = 0; x <= canvas.width; x += 120) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 120) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    zones.forEach((zone, index) => {
      const x = (zone.x / 100) * canvas.width;
      const y = (zone.y / 100) * canvas.height;
      const width = (zone.width / 100) * canvas.width;
      const height = (zone.height / 100) * canvas.height;

      context.strokeStyle = zone.included ? "#fef08a" : "#fb7185";
      context.lineWidth = 8;
      context.strokeRect(x, y, width, height);

      context.fillStyle = "#ffffff";
      context.font = "bold 48px Arial";
      context.fillText(`${index + 1}`, x + 20, y + 60);
    });

    context.fillStyle = "#ffffff";
    context.font = "bold 42px Arial";
    context.fillText("GlowCast Alignment Guide", 40, canvas.height - 50);

    const link = document.createElement("a");
    link.download = "glowcast-alignment-guide.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="appShell">
      <section className="heroPanel">
        <div>
          <p className="eyebrow">GlowCast v0.2 Prototype</p>
          <h1>Draw projection zones directly on your surface.</h1>
          <p className="subtitle">
            Upload a wall, house, garage, storefront, or stage photo. Drag over
            windows, doors, signs, or panels to create projection zones.
          </p>
        </div>

        <label className="uploadButton">
          <ImagePlus size={20} />
          Upload Surface Photo
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </label>
      </section>

      <section className="workspace">
        <aside className="toolPanel">
          <div className="panelBlock">
            <h2>1. Surface Setup</h2>

            <button
              className="primary"
              onClick={() => setDrawMode((value) => !value)}
              disabled={!imageUrl}
            >
              {drawMode ? <MousePointer2 size={18} /> : <Pencil size={18} />}
              {drawMode ? "Drawing Mode On" : "Draw Zones"}
            </button>

            <button onClick={addDummyAiZones} disabled={!imageUrl}>
              <Sparkles size={18} />
              Dummy AI Detect Areas
            </button>

            <button onClick={addZone} disabled={!imageUrl}>
              <Plus size={18} />
              Add Manual Zone
            </button>

            <p className="helperText">
              {drawMode
                ? "Drag on the photo to draw a projection zone."
                : "Turn on Draw Zones or tap an existing zone to edit it."}
            </p>
          </div>

          <div className="panelBlock">
            <h2>2. Projection Logic</h2>
            <label className="toggle">
              <input
                type="checkbox"
                checked={invertMode}
                onChange={(event) => setInvertMode(event.target.checked)}
              />
              Project around selected areas
            </label>
          </div>

          <div className="panelBlock">
            <h2>3. Effect</h2>
            <div className="effectList">
              {effects.map((effect) => (
                <button
                  key={effect.id}
                  className={activeEffect === effect.id ? "activeEffect" : ""}
                  onClick={() => setActiveEffect(effect.id)}
                >
                  {effect.name}
                  <span>{effect.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panelBlock">
            <h2>4. Export</h2>
            <button
              className="primary"
              onClick={exportAlignmentGuide}
              disabled={!imageUrl}
            >
              <Download size={18} />
              Export Alignment Guide
            </button>
          </div>
        </aside>

        <section className="stageWrap">
          <div
            ref={stageRef}
            className={`stage ${activeEffectClass} ${
              invertMode ? "invertMode" : ""
            } ${drawMode ? "drawMode" : ""}`}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={finishDrawingZone}
            onPointerCancel={() => setDraftZone(null)}
          >
            {!imageUrl && (
              <div className="emptyState">
                <ScanLine size={48} />
                <h2>Upload a surface photo to start.</h2>
                <p>
                  Start with a house, wall, garage door, window, storefront, or
                  stage backdrop.
                </p>
              </div>
            )}

            {imageUrl && <img src={imageUrl} alt="Projection surface" draggable={false} />}

            {imageUrl &&
              zones.map((zone, index) => (
                <button
                  key={zone.id}
                  className={`zone ${zone.included ? "included" : "excluded"} ${
                    selectedZoneId === zone.id ? "selected" : ""
                  }`}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedZoneId(zone.id);
                    setDrawMode(false);
                  }}
                  title="Select zone"
                >
                  <span>{index + 1}</span>
                </button>
              ))}

            {draftRect && (
              <div
                className="draftZone"
                style={{
                  left: `${draftRect.x}%`,
                  top: `${draftRect.y}%`,
                  width: `${draftRect.width}%`,
                  height: `${draftRect.height}%`
                }}
              />
            )}

            {imageUrl && <div className="watermark">GlowCast Free Preview</div>}
          </div>

          {selectedZone && (
            <div className="zoneEditor">
              <strong>
                Zone {zones.findIndex((zone) => zone.id === selectedZone.id) + 1}
              </strong>

              <label>
                X
                <input
                  type="number"
                  value={selectedZone.x}
                  min={0}
                  max={100}
                  onChange={(event) =>
                    updateSelectedZone({ x: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Y
                <input
                  type="number"
                  value={selectedZone.y}
                  min={0}
                  max={100}
                  onChange={(event) =>
                    updateSelectedZone({ y: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Width
                <input
                  type="number"
                  value={selectedZone.width}
                  min={1}
                  max={100}
                  onChange={(event) =>
                    updateSelectedZone({ width: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Height
                <input
                  type="number"
                  value={selectedZone.height}
                  min={1}
                  max={100}
                  onChange={(event) =>
                    updateSelectedZone({ height: Number(event.target.value) })
                  }
                />
              </label>

              <button
                onClick={() =>
                  updateSelectedZone({ included: !selectedZone.included })
                }
              >
                {selectedZone.included ? "Included" : "Excluded"}
              </button>

              <button onClick={deleteSelectedZone}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
