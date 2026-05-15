import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const helperMarker = '  function renderPolygonProjectionLayer(extra = "") {';
const helper = String.raw`
  function renderZoneMaskShape(zone: ProjectZone, key: string) {
    const x = zone.x;
    const y = zone.y;
    const width = zone.width;
    const height = zone.height;
    const shape = zone.shape ?? "rectangle";

    if (zone.points && zone.points.length >= 3) {
      return (
        <polygon
          key={key}
          points={zone.points.map((point) => point.x + "," + point.y).join(" ")}
          fill="black"
        />
      );
    }

    if (shape === "circle") {
      const size = Math.min(width, height);
      return (
        <circle
          key={key}
          cx={x + width / 2}
          cy={y + height / 2}
          r={size / 2}
          fill="black"
        />
      );
    }

    if (shape === "oval") {
      return (
        <ellipse
          key={key}
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          fill="black"
        />
      );
    }

    if (shape === "triangle") {
      return (
        <polygon
          key={key}
          points={(x + width / 2) + "," + y + " " + (x + width) + "," + (y + height) + " " + x + "," + (y + height)}
          fill="black"
        />
      );
    }

    if (shape === "freehand") {
      const points = [
        (x + width * 0.08) + "," + (y + height * 0.42),
        (x + width * 0.18) + "," + (y + height * 0.18),
        (x + width * 0.38) + "," + (y + height * 0.06),
        (x + width * 0.62) + "," + (y + height * 0.08),
        (x + width * 0.84) + "," + (y + height * 0.22),
        (x + width * 0.94) + "," + (y + height * 0.48),
        (x + width * 0.84) + "," + (y + height * 0.78),
        (x + width * 0.58) + "," + (y + height * 0.94),
        (x + width * 0.28) + "," + (y + height * 0.88),
        (x + width * 0.08) + "," + (y + height * 0.62)
      ].join(" ");

      return <polygon key={key} points={points} fill="black" />;
    }

    return <rect key={key} x={x} y={y} width={width} height={height} fill="black" />;
  }
`;

if (!source.includes("function renderZoneMaskShape(zone: ProjectZone, key: string)")) {
  source = source.replace(helperMarker, helper + "\n" + helperMarker);
}

source = source.replace(
  /\{includedZones\.map\(\(zone\) => \(\n\s*<rect key=\{`pm-\$\{zone\.id\}`} x=\{zone\.x\} y=\{zone\.y\} width=\{zone\.width\} height=\{zone\.height\} fill="black" \/>\n\s*\)\)\}/,
  "{includedZones.map((zone) => renderZoneMaskShape(zone, `pm-${zone.id}`))}"
);

writeFileSync(path, source);
