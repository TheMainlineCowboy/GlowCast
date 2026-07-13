import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldSummary = 'Debug: {detectionDebug.edgePoints.toLocaleString()} edges · {detectionDebug.candidateMasks} masks · {detectionDebug.polygonScoped ? "surface polygon scoped" : "full surface bounds"} · {detectionDebug.source}{detectionDebug.detectorDiagnostics ? ` · components ${detectionDebug.detectorDiagnostics.components} · rejected: closure ${detectionDebug.detectorDiagnostics.rejectedClosure}, size ${detectionDebug.detectorDiagnostics.rejectedSize}, aspect ${detectionDebug.detectorDiagnostics.rejectedAspect}, confidence ${detectionDebug.detectorDiagnostics.rejectedConfidence} · boundary penalties ${detectionDebug.detectorDiagnostics.boundaryPenalized}` : ""}';
const newSummary = 'Detection summary: {detectionDebug.edgePoints.toLocaleString()} edges analyzed · {detectionDebug.candidateMasks} usable mask{detectionDebug.candidateMasks === 1 ? "" : "s"} created · {detectionDebug.polygonScoped ? "limited to your projection surface" : "scanned across the full surface"}';

if (source.includes(newSummary)) {
  console.log("Friendly detection summary already present.");
} else if (source.includes(oldSummary)) {
  source = source.replace(oldSummary, newSummary);
  await fs.writeFile(path, source);
  console.log("Replaced technical detector debug text with a user-friendly summary.");
} else {
  throw new Error("Detector debug summary anchor not found.");
}
