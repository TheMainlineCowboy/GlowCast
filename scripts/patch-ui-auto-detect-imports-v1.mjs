import fs from "node:fs";

const appPath = "src/App.tsx";
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

const runnerImport = 'import { runCandidateDetection } from "./core/runCandidateDetection";';
const diagnosticsImport = 'import type { DetectorDiagnostics } from "./core/architecturalDetector";';

if (!source.includes(runnerImport) || !source.includes(diagnosticsImport)) {
  const edgeImportPattern = /^import\s+\{[^\n]*\}\s+from "\.\/edgeDetect";$/m;
  const edgeImport = source.match(edgeImportPattern)?.[0];

  if (!edgeImport) {
    throw new Error("Could not find an edge detector import for auto-detect imports.");
  }

  const additions = [];
  if (!source.includes(runnerImport)) additions.push(runnerImport);
  if (!source.includes(diagnosticsImport)) additions.push(diagnosticsImport);

  source = source.replace(edgeImport, `${edgeImport}\n${additions.join("\n")}`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log("Applied auto-detect imports patch.");
} else {
  console.log("No changes made. Auto-detect imports may already be applied.");
}
