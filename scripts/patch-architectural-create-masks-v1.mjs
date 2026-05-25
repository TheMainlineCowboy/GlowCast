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
  '      const scoped = edgePoints.filter((point) => point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height);',
  '      const strong = [...scoped].sort((a, b) => b.strength - a.strength).slice(0, Math.max(12, Math.floor(scoped.length * 0.55)));',
  '      const seeds = strong.filter((point, index, all) => all.findIndex((other) => Math.hypot(other.x - point.x, other.y - point.y) < Math.min(bounds.width, bounds.height) * 0.16) === index).slice(0, 5);',
  '      candidateZones = seeds.map((seed, index) => {',
  '        const nearby = scoped.filter((point) => Math.hypot(point.x - seed.x, point.y - seed.y) < Math.min(bounds.width, bounds.height) * 0.20);',
  '        const xs = nearby.length ? nearby.map((point) => point.x) : [seed.x];',
  '        const ys = nearby.length ? nearby.map((point) => point.y) : [seed.y];',
  '        const minX = Math.min(...xs);',
  '        const maxX = Math.max(...xs);',
  '        const minY = Math.min(...ys);',
  '        const maxY = Math.max(...ys);',
  '        const width = Math.max(bounds.width * 0.13, Math.min(bounds.width * 0.26, (maxX - minX) + bounds.width * 0.06));',
  '        const height = Math.max(bounds.height * 0.18, Math.min(bounds.height * 0.38, (maxY - minY) + bounds.height * 0.08));',
  '        return clampZone({',
  '          id: now + 100 + index,',
  '          x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, seed.x - width / 2)),',
  '          y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, seed.y - height / 2)),',
  '          width,',
  '          height,',
  '          included: true,',
  '          label: "edge cluster candidate " + String(index + 1),',
  '          shape: "rectangle"',
  '        });',
  '      });',
  '    }',
  '    if (candidateZones.length > 0) {',
  '      setZones((current) => [...current, ...candidateZones]);',
  '      setSelectedTarget("zone");',
  '      setSelectedZoneId(candidateZones[0]?.id ?? null);',
  '      setDetectMessage((result.candidates.length > 0 ? "Added auto avoid masks. " : "No boxes found, added edge-cluster masks. ") + "Adjust or delete any bad ones.");',
  '    } else {',
  '      setDetectMessage("No candidates found. Use manual masks.");',
  '    }'
].join("\n");

if (s.includes(oldText)) s = s.replace(oldText, newText);

writeFileSync(p, s);
