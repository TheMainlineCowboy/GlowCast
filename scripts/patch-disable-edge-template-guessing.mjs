import { readFileSync, writeFileSync } from "node:fs";

const path = "src/edgeDetect.ts";
let source = readFileSync(path, "utf8");

// The template scanner was sliding generic circles/ovals/triangles across the edge map.
// That caused random-looking shape masks. Candidate masks should come from real connected
// edge components first, not guessed shape templates.
source = source.replace(
  /const rectangleCandidates = buildWindowCandidates\(edgePoints, projectionZone\)\n\s*\.filter\(\(box\) => \{\n\s*const area = box\.width \* box\.height;\n\s*return requestedShape === "rectangle" \|\| area <= projectionArea \* 0\.18;\n\s*\}\)\n\s*\.map\(\(box\) => \(\{\n\s*\.\.\.box,\n\s*detectedShape: requestedShape === "rectangle" \? "rectangle" as DetectedMaskShape : classifyBoxShape\(box\)\n\s*\}\)\);\n\s*const shapeCandidates = requestedShape === "rectangle" \? \[\] : templateShapeCandidates\(edgePoints, projectionZone\)\n\s*\.filter\(\(box\) => requestedShape === "auto" \|\| box\.detectedShape === requestedShape\);\n\s*const candidates = mergeCandidateBoxes\(\[\.\.\.shapeCandidates, \.\.\.rectangleCandidates\]\);/,
  `const rectangleCandidates = buildWindowCandidates(edgePoints, projectionZone)
    .filter((box) => {
      const area = box.width * box.height;
      return area <= projectionArea * 0.22;
    })
    .map((box) => ({
      ...box,
      detectedShape: "rectangle" as DetectedMaskShape
    }));
  const shapeCandidates: ComponentBox[] = [];
  const candidates = mergeCandidateBoxes([...rectangleCandidates, ...shapeCandidates]);`
);

source = source.replace(
  /function templateShapeCandidates\(edgePoints: EdgePoint\[\], projectionZone: ProjectionZone\): ComponentBox\[\] \{/, 
  `function templateShapeCandidates(edgePoints: EdgePoint[], projectionZone: ProjectionZone): ComponentBox[] {
  void edgePoints;
  void projectionZone;
  return [];

  // Disabled: template shape guessing made random circles/ovals/triangles instead of real masks.`
);

writeFileSync(path, source);
console.log("disabled guessed circle/oval/triangle template edge masks");
