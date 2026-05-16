import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let text = readFileSync(path, "utf8");

if (!text.includes("const [showSurfaceGuideOnMask")) {
  text = text.replace(
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);",
    "  const [showSurfaceHandles, setShowSurfaceHandles] = useState(true);\n  const [showSurfaceGuideOnMask, setShowSurfaceGuideOnMask] = useState(true);"
  );
}

text = text.replaceAll(
  "{surfacePolygonOverlay()}",
  "{(step !== \"mask\" || showSurfaceGuideOnMask) ? surfacePolygonOverlay() : null}"
);

text = text.replace(
  "<button type=\"button\" onClick={() => setStep(\"start\")}>Adjust Projection Surface</button>",
  "<button type=\"button\" onClick={() => setStep(\"start\")}>Adjust Projection Surface</button>\n              <button type=\"button\" onClick={() => setShowSurfaceGuideOnMask((current) => !current)} disabled={!surfacePolygonPoints.length}>{showSurfaceGuideOnMask ? \"Hide Surface Guide\" : \"Show Surface Guide\"}</button>"
);

writeFileSync(path, text);
