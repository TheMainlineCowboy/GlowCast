import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function hasSparseMidBridge(";
if (!source.includes(marker)) {
  const insertAt = source.indexOf("function buildFallbackComponents(");
  if (insertAt < 0) throw new Error("Unable to locate fallback component builder");

  const helper = `function hasSparseMidBridge(points: EdgePoint[], box: SimpleBox, bounds: SimpleBox): boolean {
  const boxArea = box.width * box.height;
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const horizontal = box.width >= box.height;
  const majorSpan = horizontal ? box.width : box.height;
  const boundsSpan = horizontal ? bounds.width : bounds.height;

  // Only challenge large fallback components. Compact openings and fixtures should
  // never be removed by this bridge-specific cleanup.
  if (boxArea < boundsArea * 0.06 || majorSpan < boundsSpan * 0.32) return false;

  const thirds = [new Set<string>(), new Set<string>(), new Set<string>()];
  for (const point of points) {
    const position = horizontal
      ? (point.x - box.x) / Math.max(box.width, 0.01)
      : (point.y - box.y) / Math.max(box.height, 0.01);
    if (position < -0.02 || position > 1.02) continue;
    const bucket = Math.min(2, Math.max(0, Math.floor(position * 3)));
    const key = horizontal
      ? String(Math.round(point.x)) + "," + String(Math.round(point.y))
      : String(Math.round(point.y)) + "," + String(Math.round(point.x));
    thirds[bucket].add(key);
  }

  const leftOrTop = thirds[0].size;
  const middle = thirds[1].size;
  const rightOrBottom = thirds[2].size;
  const outerFloor = Math.min(leftOrTop, rightOrBottom);

  // Two substantial outer structures joined by only a thin run through the middle
  // are characteristic of separate openings accidentally connected by façade clutter.
  return outerFloor >= 10 && middle <= Math.max(4, outerFloor * 0.3);
}

`;

  source = source.slice(0, insertAt) + helper + source.slice(insertAt);
}

const densityAnchor = "    const densityScore = edgeCount / Math.max(area, 1);";
const gate = "    if (hasSparseMidBridge(componentPoints, box, bounds)) continue;";
if (!source.includes(gate)) {
  if (!source.includes(densityAnchor)) throw new Error("Unable to locate fallback density score anchor");
  source = source.replace(densityAnchor, `${densityAnchor}\n${gate}`);
}

if (!source.includes(marker) || !source.includes(gate)) {
  throw new Error("Thin-bridge fallback rejection was not fully applied");
}

await fs.writeFile(adapterPath, source);
await import("./patch-fallback-recover-thin-bridge-openings-v1.mjs");
await import("./smoke-fallback-recover-thin-bridge-openings-runtime.mjs");
await import("./patch-fallback-recover-offset-diagonal-bridges-v1.mjs");
await import("./smoke-fallback-recover-offset-diagonal-bridges-runtime.mjs");
console.log("Rejected unrecoverable thin bridges and recovered qualifying architectural openings from centered, offset, and diagonal sparse bridge clutter.");
