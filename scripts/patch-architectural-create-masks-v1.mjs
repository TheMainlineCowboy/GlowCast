import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

const oldText = '    setArchitecturalResult(result);\n    setArchitecturalDebug(true);\n    setDetectMessage(`Architectural debug: ${result.lines.length} structural lines, ${result.candidates.length} candidates. Green = high confidence, yellow = rejected/low confidence.`);';

const newText = [
  '    setArchitecturalResult(result);',
  '    setArchitecturalDebug(true);',
  '    if (result.candidates.length > 0) {',
  '      const now = Date.now();',
  '      const candidateZones: ProjectZone[] = result.candidates.map((candidate, index) => clampZone({',
  '        id: now + index,',
  '        x: candidate.x,',
  '        y: candidate.y,',
  '        width: candidate.width,',
  '        height: candidate.height,',
  '        included: true,',
  '        label: `auto candidate ${index + 1}`,',
  '        shape: "rectangle"',
  '      }));',
  '      setZones((current) => [...current, ...candidateZones]);',
  '      setSelectedTarget("zone");',
  '      setSelectedZoneId(candidateZones[0]?.id ?? null);',
  '      setDetectMessage(`Added ${candidateZones.length} auto avoid masks from structural candidates. Adjust any bad ones.`);',
  '    } else {',
  '      setDetectMessage(`Architectural debug: ${result.lines.length} structural lines, 0 candidates. Try a tighter projection surface or use manual masks.`);',
  '    }'
].join("\n");

if (s.includes(oldText)) {
  s = s.replace(oldText, newText);
}

writeFileSync(p, s);
