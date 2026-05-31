import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

const oldFunction = `function outerTrimExpansionAmount(box: ProjectionZone, projectionZone: ProjectionZone) {
  const objectSize = Math.min(box.width, box.height);
  const wallRelativeMinimum = Math.min(projectionZone.width, projectionZone.height) * 0.018;
  const objectRelative = objectSize * 0.22;
  // The flood-fill finds the inside glass / inside opening. Grow that closed loop outward
  // so the usable mask begins on the outer window trim / object frame instead.
  return Math.max(0.8, wallRelativeMinimum, Math.min(objectRelative, 3.2));
}`;

const newFunction = `function outerTrimExpansionAmount(box: ProjectionZone, projectionZone: ProjectionZone) {
  const objectSize = Math.min(box.width, box.height);
  const wallRelativeMinimum = Math.min(projectionZone.width, projectionZone.height) * 0.018;
  const objectRelative = objectSize * 0.2;
  // This is now only a safety pad. The actual outside trim/frame is found from nearby
  // scanned edge pixels below, instead of blindly ballooning the inside opening outward.
  return Math.max(0.45, wallRelativeMinimum, Math.min(objectRelative, 1.85));
}`;

if (!source.includes(oldFunction)) {
  throw new Error("Could not find current outer trim expansion function to replace.");
}
source = source.replace(oldFunction, newFunction);

const helperAnchor = `function gridPointToProjection(x: number, y: number, width: number, height: number, projectionZone: ProjectionZone): Coordinate {
  return {
    x: projectionZone.x + (x / Math.max(1, width - 1)) * projectionZone.width,
    y: projectionZone.y + (y / Math.max(1, height - 1)) * projectionZone.height
  };
}
`;

const helperInsert = `${helperAnchor}
function collectNearbyOuterEdgePoints(edgePoints: EdgePoint[], innerBox: ProjectionZone, projectionZone: ProjectionZone): Coordinate[] {
  const objectSize = Math.max(innerBox.width, innerBox.height);
  const padX = Math.max(projectionZone.width * 0.018, objectSize * 0.55, 1.8);
  const padY = Math.max(projectionZone.height * 0.028, objectSize * 0.55, 1.8);
  const minX = Math.max(projectionZone.x, innerBox.x - padX);
  const maxX = Math.min(projectionZone.x + projectionZone.width, innerBox.x + innerBox.width + padX);
  const minY = Math.max(projectionZone.y, innerBox.y - padY);
  const maxY = Math.min(projectionZone.y + projectionZone.height, innerBox.y + innerBox.height + padY);

  const candidates = edgePoints
    .filter((point) => {
      if (point.strength < 52) return false;
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) return false;
      // Ignore random snow/noise dots inside the already-filled opening. We want the
      // surrounding trim/frame edge pixels just outside the opening.
      const insideInner =
        point.x >= innerBox.x + innerBox.width * 0.08 &&
        point.x <= innerBox.x + innerBox.width * 0.92 &&
        point.y >= innerBox.y + innerBox.height * 0.08 &&
        point.y <= innerBox.y + innerBox.height * 0.92;
      return !insideInner;
    })
    .map((point) => ({ x: point.x, y: point.y }));

  if (candidates.length < 8) return [];
  const nearbyBounds = boundsFromPoints(candidates);
  const area = nearbyBounds.width * nearbyBounds.height;
  const innerArea = Math.max(0.01, innerBox.width * innerBox.height);
  if (area < innerArea * 0.75 || area > innerArea * 5.8) return [];
  return candidates;
}
`;

if (!source.includes(helperAnchor)) {
  throw new Error("Could not find gridPointToProjection anchor for outer-edge helper.");
}
source = source.replace(helperAnchor, helperInsert);

const oldRawPointsBlock = `      const rawPoints = boundaryPoints.length >= 3 ? boundaryPoints : [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height }
      ];
      const hull = simplifyPolygon(convexHull(rawPoints));
      if (hull.length < 3) continue;
      const expanded = expandPolygon(hull, outerTrimExpansionAmount(box, projectionZone), projectionZone);`;

const newRawPointsBlock = `      const nearbyOuterEdgePoints = collectNearbyOuterEdgePoints(edgePoints, box, projectionZone);
      const rawPoints = nearbyOuterEdgePoints.length >= 8 ? nearbyOuterEdgePoints : (boundaryPoints.length >= 3 ? boundaryPoints : [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height }
      ]);
      const hull = simplifyPolygon(convexHull(rawPoints));
      if (hull.length < 3) continue;
      const expanded = expandPolygon(hull, outerTrimExpansionAmount(box, projectionZone), projectionZone);`;

if (!source.includes(oldRawPointsBlock)) {
  throw new Error("Could not find raw polygon point block for outer-edge snapping.");
}
source = source.replace(oldRawPointsBlock, newRawPointsBlock);

writeFileSync(path, source);
console.log("edge masks now snap to nearby outer trim/frame edge pixels instead of filling only inner openings");
