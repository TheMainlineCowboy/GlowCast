import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const helperAnchor = '  function renderProjectionLayer(extra = "") {';
const helper = [
  '  function renderZoneMaskShape(zone: ProjectZone, key: string) {',
  '    const shape = zone.shape ?? "rectangle";',
  '    if (shape === "circle" || shape === "oval") {',
  '      return <ellipse key={key} cx={zone.x + zone.width / 2} cy={zone.y + zone.height / 2} rx={zone.width / 2} ry={zone.height / 2} fill="black" />;',
  '    }',
  '    if (shape === "triangle") {',
  '      const points = String(zone.x + zone.width / 2) + "," + String(zone.y) + " " + String(zone.x + zone.width) + "," + String(zone.y + zone.height) + " " + String(zone.x) + "," + String(zone.y + zone.height);',
  '      return <polygon key={key} points={points} fill="black" />;',
  '    }',
  '    return <rect key={key} x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="black" />;',
  '  }',
  '',
  ''
].join("\n");

if (!source.includes("function renderZoneMaskShape") && source.includes(helperAnchor)) {
  source = source.replace(helperAnchor, helper + helperAnchor);
}

source = source.replace(
  /\{includedZones\.map\(\(zone\) => \(\s*<rect key=\{`pm-\$\{zone\.id\}`} x=\{zone\.x\} y=\{zone\.y\} width=\{zone\.width\} height=\{zone\.height\} fill="black" \/>\s*\)\)\}/,
  '{includedZones.map((zone) => renderZoneMaskShape(zone, "pm-" + zone.id))}'
);

writeFileSync(appPath, source);
