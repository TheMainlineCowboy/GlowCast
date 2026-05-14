import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Camera, Move, Square, Circle, Triangle, 
  Trash2, Play, X, Sliders, Wand2, Target, 
  Layers, Magnet, Eye, EyeOff 
} from 'lucide-react';
import { mat4, vec3 } from 'gl-matrix';

// --- Types ---
interface Point { x: number; y: number; }
interface Shape {
  id: string;
  type: 'rect' | 'oval' | 'triangle' | 'freehand';
  x: number;
  y: number;
  width: number;
  height: number;
  effect: string;
  excluded: boolean;
}

export default function GlowCastApp() {
  // --- State ---
  const [step, setStep] = useState<'start' | 'surface' | 'masking' | 'projecting'>('start');
  const [photo, setPhoto] = useState<string | null>(null);
  const [surfacePoints, setSurfacePoints] = useState<Point[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [tool, setTool] = useState<string>('rect');
  const [magneticSnap, setMagneticSnap] = useState(true);
  const [showEdgeScanner, setShowEdgeScanner] = useState(false);
  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true); // PATCH B
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 900 }); // Default, updated by PATCH A

  const stageRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);

  // --- Patch A: Calculate True Wall Aspect Ratio ---
  const finalizeSurface = useCallback(() => {
    if (surfacePoints.length !== 4) return;

    // Calculate natural distances between corners to find "True Wall" shape
    const topW = Math.hypot(surfacePoints[1].x - surfacePoints[0].x, surfacePoints[1].y - surfacePoints[0].y);
    const bottomW = Math.hypot(surfacePoints[2].x - surfacePoints[3].x, surfacePoints[2].y - surfacePoints[3].y);
    const leftH = Math.hypot(surfacePoints[3].x - surfacePoints[0].x, surfacePoints[3].y - surfacePoints[0].y);
    const rightH = Math.hypot(surfacePoints[2].x - surfacePoints[1].x, surfacePoints[2].y - surfacePoints[1].y);

    const calculatedWidth = (topW + bottomW) / 2;
    const calculatedHeight = (leftH + rightH) / 2;

    setCanvasSize({ width: calculatedWidth, height: calculatedHeight });
    setStep('masking');
    setShowSurfaceHandles(false); // PATCH B: Auto-hide handles after flattening
  }, [surfacePoints]);

  // --- Patch D: Post-Draw Magnetic Snapping ---
  const findNearestEdge = (val: number, axis: 'x' | 'y') => {
    // In a real impl, this would query a pre-calculated Map of edge scanner points
    // For this logic patch, we simulate the "Gravity Well" lookup
    return val; // Placeholder for edge lookup logic
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing || !drawStart) return;
    
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    let endX = ((e.clientX - rect.left) / rect.width) * 100;
    let endY = ((e.clientY - rect.top) / rect.height) * 100;

    let finalX = Math.min(drawStart.x, endX);
    let finalY = Math.min(drawStart.y, endY);
    let finalW = Math.abs(endX - drawStart.x);
    let finalH = Math.abs(endY - drawStart.y);

    // Patch D: Snap the resulting rectangle boundaries
    if (magneticSnap && tool === 'rect') {
        const gravity = 2.0; // 2% of canvas width
        // Logic would adjust finalX, finalY, finalW, finalH based on edge detection
    }

    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: tool as any,
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH,
      effect: 'neon',
      excluded: false
    };

    setShapes([...shapes, newShape]);
    setIsDrawing(false);
    setDrawStart(null);
  };

  // --- UI Components ---
  return (
    <div className="appShell">
      <header className="heroPanel">
        <div>
          <span className="eyebrow">Zero-Cost Architectural Mapper</span>
          <h1>GlowCast Studio</h1>
          <p className="subtitle">Precision wall-flattening and mask mapping.</p>
        </div>
        {step !== 'start' && (
          <button className="fileButton" onClick={() => window.location.reload()}>
            <X size={18} /> New Project
          </button>
        )}
      </header>

      {step === 'start' && (
        <div className="startPage">
          <div className="startCard">
            <h2>Start New Mapping</h2>
            <p>Upload a straight-on photo of your house or building.</p>
            <label className="uploadButton">
              <Upload size={20} />
              <span>Select Reference Photo</span>
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhoto(URL.createObjectURL(file));
                  setStep('surface');
                }
              }} />
            </label>
          </div>
        </div>
      )}

      {step !== 'start' && (
        <div className="workspace">
          <aside className="toolPanel">
            <div className="panelBlock">
              <h2>1. Wall Alignment</h2>
              <button 
                className={step === 'surface' ? 'primary' : ''} 
                onClick={() => setStep('surface')}
              >
                <Target size={18} /> {surfacePoints.length < 4 ? `Set Corners (${surfacePoints.length}/4)` : 'Adjust Corners'}
              </button>
              {surfacePoints.length === 4 && step === 'surface' && (
                <button className="primary" onClick={finalizeSurface}>
                  Apply Flattening & Lock
                </button>
              )}
            </div>

            <div className="panelBlock">
              <h2>2. Architectural Aids</h2>
              <button 
                className={showEdgeScanner ? 'activeEffect' : ''} 
                onClick={() => setShowEdgeScanner(!showEdgeScanner)}
              >
                <Wand2 size={18} /> {showEdgeScanner ? 'Hide Edge Scanner' : 'Show Edge Scanner'}
              </button>
              <div className="toggle">
                <input 
                  type="checkbox" 
                  id="snap" 
                  checked={magneticSnap} 
                  onChange={(e) => setMagneticSnap(e.target.checked)} 
                />
                <label htmlFor="snap"><Magnet size={14} /> Magnetic Snap</label>
              </div>
            </div>

            <div className="panelBlock">
              <h2>3. Masking Tools</h2>
              <div className="shapeToolRow">
                <button className={tool === 'rect' ? 'primary' : ''} onClick={() => setTool('rect')}><Square size={16} /></button>
                <button className={tool === 'oval' ? 'primary' : ''} onClick={() => setTool('oval')}><Circle size={16} /></button>
                <button className={tool === 'triangle' ? 'primary' : ''} onClick={() => setTool('triangle')}><Triangle size={16} /></button>
                <button className={tool === 'freehand' ? 'primary' : ''} onClick={() => setTool('freehand')}><Move size={16} /></button>
              </div>
              
              {/* PATCH B: Surface Handle Toggle */}
              <button onClick={() => setShowSurfaceHandles(!showSurfaceHandles)}>
                {showSurfaceHandles ? <EyeOff size={18} /> : <Eye size={18} />}
                {showSurfaceHandles ? " Hide Wall Handles" : " Show Wall Handles"}
              </button>
            </div>

            {selectedShapeId && (
              <div className="panelBlock">
                <h2>Edit Selected</h2>
                <button onClick={() => setShapes(shapes.filter(s => s.id !== selectedShapeId))}>
                  <Trash2 size={18} /> Delete Mask
                </button>
              </div>
            )}

            <div className="panelBlock">
              <button className="primary" style={{marginTop: '20px'}} onClick={() => setStep('projecting')}>
                <Play size={18} /> Launch Projection
              </button>
            </div>
          </aside>

          <main className="stageWrap">
            <div 
              ref={stageRef}
              className={`surfaceLayer ${tool ? 'drawMode' : ''}`}
              onPointerDown={(e) => {
                if (step === 'surface' && surfacePoints.length < 4) {
                   const rect = stageRef.current?.getBoundingClientRect();
                   if (rect) {
                     setSurfacePoints([...surfacePoints, {
                       x: ((e.clientX - rect.left) / rect.width) * 100,
                       y: ((e.clientY - rect.top) / rect.height) * 100
                     }]);
                   }
                } else if (step === 'masking') {
                  const rect = stageRef.current?.getBoundingClientRect();
                  if (rect) {
                    setIsDrawing(true);
                    setDrawStart({
                      x: ((e.clientX - rect.left) / rect.width) * 100,
                      y: ((e.clientY - rect.top) / rect.height) * 100
                    });
                  }
                }
              }}
              onPointerUp={handlePointerUp}
            >
              {photo && <img src={photo} className="referencePhoto" alt="Building" />}
              
              {/* PATCH B: Conditional rendering of wall handles */}
              {showSurfaceHandles && surfacePoints.map((p, i) => (
                <div 
                  key={i} 
                  className="resizeHandle" 
                  style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }} 
                />
              ))}

              {showEdgeScanner && (
                <div className="edgeOverlay">
                  {/* The actual Edge Scanner would be a canvas or SVG overlay here */}
                  <div style={{ position: 'absolute', inset: 0, border: '2px solid #22d3ee', opacity: 0.3 }} />
                </div>
              )}

              {shapes.map(shape => (
                <div 
                  key={shape.id}
                  className={`zone ${shape.id === selectedShapeId ? 'selected' : ''}`}
                  style={{
                    left: `${shape.x}%`,
                    top: `${shape.y}%`,
                    width: `${shape.width}%`,
                    height: `${shape.height}%`,
                    borderRadius: shape.type === 'oval' ? '50%' : '0'
                  }}
                  onClick={() => setSelectedShapeId(shape.id)}
                />
              ))}
            </div>
            <p className="helperText">
              {step === 'surface' ? "Click the 4 corners of your wall (Top-Left, Top-Right, Bottom-Right, Bottom-Left)." : "Drag to draw window and door masks."}
            </p>
          </main>
        </div>
      )}

      {step === 'projecting' && (
        <div className="projectorShell">
          <button className="projectorExit" onClick={() => setStep('masking')}>Exit Projection</button>
          <div className="projectorCanvas" style={{ aspectRatio: `${canvasSize.width}/${canvasSize.height}` }}>
             {/* Flattened content goes here */}
             <h1 style={{color: 'white'}}>Projection Active</h1>
          </div>
        </div>
      )}
    </div>
  );
}
