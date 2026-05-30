import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const stateAnchor = "  const [snapEnabled, setSnapEnabled] = useState(true);";
if (source.includes(stateAnchor) && !source.includes("edgeDebugMode")) {
  source = source.replace(stateAnchor, stateAnchor + "\n  const [edgeDebugMode, setEdgeDebugMode] = useState(false);");
}

const helperAnchor = "  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {";
if (source.includes(helperAnchor) && !source.includes("function edgeDebugSummary()")) {
  const helper = `  function edgeDebugSummary() {
    const candidates = zones.filter((zone) => zone.label === "edge candidate");
    return {
      edgePoints: edgePoints.length,
      candidates: candidates.length,
      selected: selectedZone ? {
        id: selectedZone.id,
        label: selectedZone.label,
        x: Number(selectedZone.x.toFixed(2)),
        y: Number(selectedZone.y.toFixed(2)),
        width: Number(selectedZone.width.toFixed(2)),
        height: Number(selectedZone.height.toFixed(2)),
        included: selectedZone.included
      } : null,
      candidatesList: candidates.map((zone, index) => ({
        number: index + 1,
        id: zone.id,
        x: Number(zone.x.toFixed(2)),
        y: Number(zone.y.toFixed(2)),
        width: Number(zone.width.toFixed(2)),
        height: Number(zone.height.toFixed(2)),
        included: zone.included,
        shape: zone.shape ?? "rectangle"
      }))
    };
  }

`;
  source = source.replace(helperAnchor, helper + helperAnchor);
}

const maskStart = source.indexOf('{step === "mask" && (');
const magneticIndex = source.indexOf('<label className="flex items-center gap-2 text-sm text-slate-200">', maskStart);
if (maskStart !== -1 && magneticIndex !== -1) {
  const maskControls = source.slice(maskStart, magneticIndex);
  if (!maskControls.includes("setEdgeDebugMode")) {
    const debugButton = `              <button type="button" onClick={() => setEdgeDebugMode((value) => !value)}>{edgeDebugMode ? "Hide Edge Debug" : "Show Edge Debug"}</button>
`;
    source = source.slice(0, magneticIndex) + debugButton + source.slice(magneticIndex);
  }
}

const detectAnchor = `{detectMessage && <p className="detectMessage">{detectMessage}</p>}`;
if (source.includes(detectAnchor) && !source.includes("edgeDebugSummary(), null, 2")) {
  const replacement = `{detectMessage && <p className="detectMessage">{detectMessage}</p>}
            {edgeDebugMode && (
              <pre className="detectMessage" style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.35, background: "rgba(15,23,42,.8)", border: "1px solid rgba(148,163,184,.35)", borderRadius: 12, padding: 12, overflowX: "auto" }}>{JSON.stringify(edgeDebugSummary(), null, 2)}</pre>
            )}`;
  source = source.replace(detectAnchor, replacement);
}

writeFileSync(appPath, source);
