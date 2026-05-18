import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let text = readFileSync(appPath, "utf8");

text = text.replace(
  /\{(?:step === \"start\" && )*surfacePolygonClosed && !projectionOnly && surfacePolygonPoints\.map\(\(point, index\) => \(/g,
  '{step === "start" && surfacePolygonClosed && !projectionOnly && surfacePolygonPoints.map((point, index) => ('
);

text = text.replace(
  /\{(?:step === \"start\" && )*projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode \? \(/g,
  '{step === "start" && projectionArea && showSurfaceHandles && !projectionOnly && !cornerMode && !surfacePolygonMode ? ('
);

text = text.replace(
  'import { createTapMaskZone } from "./manualMaskTapFix";\n',
  ''
);

text = text.replace(
  /    const rect = normalizeDraftZone\(draftZone\);\n    const zone = rect\.width < 2 \|\| rect\.height < 2\n      \? createTapMaskZone\(draftZone\.startX, draftZone\.startY, draftZone\.shape\)\n      : rect;\n    setDraftZone\(null\);\n    const id = Date\.now\(\);\n    setZones\(\(current\) => \[\n      \.\.\.current,\n      \{ id, \.\.\.zone, included: true, label: `manual \$\{draftZone\.shape\} avoid zone` \}\n    \]\);/g,
  '    const rect = normalizeDraftZone(draftZone);\n    setDraftZone(null);\n    if (rect.width < 2 || rect.height < 2) return;\n    const id = Date.now();\n    setZones((current) => [\n      ...current,\n      { id, ...rect, included: true, label: `manual ${draftZone.shape} avoid zone` }\n    ]);'
);

text = text.replace(
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(true);\n    setCornerMode(false);',
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n    setCornerMode(false);'
);

text = text.replace(
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n  }\n\n  async function openProjectorMode()',
  '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n  }\n\n  async function openProjectorMode()'
);

text = text.replace(
  `    if (
      !imageUrl || !drawMode || projectionOnly || (event.target as HTMLElement).closest(".zone,.projectionBoundary")
    ) {
      return;
    }
    const point = getPoint(event);`,
  `    const clickedEditable = (event.target as HTMLElement).closest(".zone,.projectionBoundary,.resizeHandle");
    if (!imageUrl || projectionOnly || clickedEditable) {
      return;
    }
    if (!drawMode) {
      setSelectedTarget("zone");
      setSelectedZoneId(null);
      setDraftZone(null);
      return;
    }
    const point = getPoint(event);`
);

const fullscreenEffect = `  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setProjectorMode(false);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => { document.removeEventListener("fullscreenchange", onFullscreenChange); };
  }, []);
`;

const keyboardEffect = `  useEffect(() => {
    const onMaskEditKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      if (event.key === "Escape") {
        setSelectedTarget("zone");
        setSelectedZoneId(null);
        setDraftZone(null);
        setResizeAction(null);
        setDrawMode(false);
        return;
      }

      if (event.key === "Delete" && selectedTarget === "zone" && selectedZoneId !== null) {
        event.preventDefault();
        setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
        setSelectedZoneId(null);
        setSelectedTarget("zone");
        return;
      }

      const arrowStep = event.shiftKey ? 1 : 0.25;
      const arrowMoves: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -arrowStep },
        ArrowDown: { x: 0, y: arrowStep },
        ArrowLeft: { x: -arrowStep, y: 0 },
        ArrowRight: { x: arrowStep, y: 0 }
      };
      const move = arrowMoves[event.key];
      if (move && selectedTarget === "zone" && selectedZoneId !== null) {
        event.preventDefault();
        setZones((current) => current.map((zone) => {
          if (zone.id !== selectedZoneId) return zone;
          return clampZonePositionOnly({ ...zone, x: zone.x + move.x, y: zone.y + move.y });
        }));
      }
    };

    window.addEventListener("keydown", onMaskEditKey);
    return () => { window.removeEventListener("keydown", onMaskEditKey); };
  }, [selectedTarget, selectedZoneId]);
`;

if (text.includes("onMaskEditKey")) {
  text = text.replace(/  useEffect\(\(\) => \{\n    const onMaskEditKey = \(event: KeyboardEvent\) => \{[\s\S]*?  \}, \[selectedTarget, selectedZoneId\]\);\n/, keyboardEffect);
} else if (text.includes(fullscreenEffect)) {
  text = text.replace(fullscreenEffect, fullscreenEffect + "\n" + keyboardEffect);
}

writeFileSync(appPath, text);

const cssPath = "styles.css";
let css = readFileSync(cssPath, "utf8");
if (!css.includes("Mask page surface edit hard block")) {
  css += `
/* Mask page surface edit hard block */
.maskOnlyWorkspace .surfacePointHandle,
.maskOnlyWorkspace .projectionBoundary{display:none!important;pointer-events:none!important;visibility:hidden!important;}
.maskOnlyWorkspace .surfacePolygonOverlay circle{display:none!important;pointer-events:none!important;}
.maskOnlyWorkspace .surfacePolygonOverlay{pointer-events:none!important;}
`;
}
writeFileSync(cssPath, css);
