import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

const oldText = '    setArchitecturalResult(result);\n    setArchitecturalDebug(true);\n    setDetectMessage(`Architectural debug: ${result.lines.length} structural lines, ${result.candidates.length} candidates. Green = high confidence, yellow = rejected/low confidence.`);';

const newText = [
  '    setArchitecturalResult(result);',
  '    setArchitecturalDebug(true);',
  '    const now = Date.now();',
  '    let candidateZones: ProjectZone[] = result.candidates.map((candidate, index) => clampZone({',
  '      id: now + index,',
  '      x: candidate.x,',
  '      y: candidate.y,',
  '      width: candidate.width,',
  '      height: candidate.height,',
  '      included: true,',
  '      label: "auto candidate " + String(index + 1),',
  '      shape: "rectangle"',
  '    }));',
  '    if (candidateZones.length === 0 && bounds) {',
  '      candidateZones = [0, 1, 2].map((slot) => clampZone({',
  '        id: now + 100 + slot,',
  '        x: bounds.x + bounds.width * (slot === 0 ? 0.14 : slot === 1 ? 0.40 : 0.66),',
  '        y: bounds.y + bounds.height * 0.18,',
  '        width: bounds.width * (slot === 2 ? 0.18 : 0.16),',
  '        height: bounds.height * (slot === 2 ? 0.32 : 0.28),',
  '        included: true,',
  '        label: "provisional candidate " + String(slot + 1),',
  '        shape: "rectangle"',
  '      }));',
  '    }',
  '    if (candidateZones.length > 0) {',
  '      setZones((current) => [...current, ...candidateZones]);',
  '      setSelectedTarget("zone");',
  '      setSelectedZoneId(candidateZones[0]?.id ?? null);',
  '      setDetectMessage((result.candidates.length > 0 ? "Added auto avoid masks. " : "No boxes found, added provisional masks. ") + "Adjust or delete any bad ones.");',
  '    } else {',
  '      setDetectMessage("No candidates found. Use manual masks.");',
  '    }'
].join("\n");

if (s.includes(oldText)) s = s.replace(oldText, newText);

writeFileSync(p, s);
