import { readFileSync, writeFileSync, existsSync } from "node:fs";

const appPath = "src/App.tsx";
let source = readFileSync(appPath, "utf8");

const importAnchor = 'import { generateAutoMasks, scanImageEdges, snapPointToEdge, type EdgePoint } from "./edgeDetect";';
if (source.includes(importAnchor) && !source.includes('import { generateContourMasks } from "./edgeContour";')) {
  source = source.replace(importAnchor, 'import { generateContourMasks } from "./edgeContour";\n' + importAnchor);
}

const plainReference = `<label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                <button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>`;
const referenceWithRecent = `<label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
                {visibleRecentPhotos.length > 0 && (
                  <div className="recentPhotoBlock">
                    <div className="recentHeader"><strong>Recent Photos</strong><span>Tap to reuse</span></div>
                    <div className="recentPhotoRow">
                      {visibleRecentPhotos.map((photo) => (
                        <button key={photo.id} className="recentPhotoButton" onClick={() => loadRecentPhoto(photo)} title={photo.name}>
                          <img src={photo.thumbnailUrl} alt={photo.name} />
                          <span>{photo.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>`;
if (source.includes(plainReference) && !source.includes('Reference Photo</h2>\n                <label className="uploadButton"><ImagePlus size={20} /> Change Surface Photo<input type="file" accept="image/*" onChange={handleImageUpload} /></label>\n                {visibleRecentPhotos.length > 0')) {
  source = source.replace(plainReference, referenceWithRecent);
}

const continueButton = `                <button className="primary" type="button" onClick={() => { setShowSurfaceHandles(false); setResizeAction(null); setSelectedTarget("zone"); setSelectedZoneId(null); setStep("mask"); }} disabled={!surfacePolygonClosed && !projectionArea}>Continue to Mask & Edit</button>`;
source = source.replace(continueButton + "\n", "");
const loadProjectButton = `<button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>`;
const loadProjectWithContinue = `<button onClick={() => importProjectRef.current?.click()}><FolderOpen size={18} /> Load Project File</button>
                ${continueButton}`;
const startStepIndex = source.indexOf('{step === "start" && (');
const startMaskIndex = source.indexOf('{step === "mask" && (');
if (startStepIndex !== -1 && startMaskIndex !== -1) {
  const startBlock = source.slice(startStepIndex, startMaskIndex);
  if (startBlock.includes(loadProjectButton) && !startBlock.includes('Load Project File</button>\n                <button className="primary" type="button"')) {
    const absoluteLoadIndex = source.indexOf(loadProjectButton, startStepIndex);
    if (absoluteLoadIndex !== -1 && absoluteLoadIndex < startMaskIndex) {
      source = source.slice(0, absoluteLoadIndex) + loadProjectWithContinue + source.slice(absoluteLoadIndex + loadProjectButton.length);
    }
  }
}

source = source.replace(/Create Edge Masks/g, "Create Edge Mask Candidates");
source = source.replace('included: true,\n        label: "edge contour mask"', 'included: false,\n        label: "edge candidate"');
source = source.replace(/edge fallback mask/g, "edge candidate");
source = source.replace(/Created " \+ usable\.length \+ " connected edge masks from visible edge paths\./g, 'Found " + usable.length + " connected edge mask candidates from visible edge paths.');
source = source.replace(/Created " \+ usable\.length \+ " fallback edge masks from scanned edges\./g, 'Found " + usable.length + " fallback edge mask candidates from scanned edges.');
source = source.replace(/Created " \+ usable\.length \+ " edge masks from scanned edges\./g, 'Found " + usable.length + " edge mask candidates from scanned edges.');

const resetAnchor = '  function resetForPhoto(src: string, thumbnail: string | null, size: ImageSize, message: string) {';
if (!source.includes('function applySelectedEdgeCandidate()')) {
  const helper = `  function applySelectedEdgeCandidate() {
    if (!selectedZone || selectedZone.label !== "edge candidate") {
      setDetectMessage("Select an edge candidate first.");
      return;
    }
    setZones((current) => current.map((zone) => zone.id === selectedZone.id ? { ...zone, included: true, label: "approved edge mask" } : zone));
    setDetectMessage("Applied selected edge candidate as a real mask.");
  }

  function clearEdgeCandidates() {
    setZones((current) => current.filter((zone) => zone.label !== "edge candidate"));
    if (selectedZone?.label === "edge candidate") setSelectedZoneId(null);
    setDetectMessage("Edge candidates cleared.");
  }

`;
  source = source.replace(resetAnchor, helper + resetAnchor);
}

const maskStart = source.indexOf('{step === "mask" && (');
const magneticIndex = source.indexOf('<label className="flex items-center gap-2 text-sm text-slate-200">', maskStart);
if (maskStart !== -1 && magneticIndex !== -1) {
  const chunk = source.slice(maskStart, magneticIndex);
  const createButton = `              <button type="button" onClick={createMasksFromEdges} disabled={!imageUrl || edgeScanning || !edgePoints.length} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50" >
                Create Edge Mask Candidates
              </button>
`;
  const controls = `              <button type="button" onClick={applySelectedEdgeCandidate} disabled={!selectedZone || selectedZone.label !== "edge candidate"} className="primary">
                Apply Selected Candidate
              </button>
              <button type="button" onClick={clearEdgeCandidates}>Clear Candidates</button>
`;
  let insert = "";
  if (!chunk.includes('onClick={createMasksFromEdges}')) insert += createButton;
  if (!chunk.includes('applySelectedEdgeCandidate')) insert += controls;
  if (insert) source = source.slice(0, magneticIndex) + insert + source.slice(magneticIndex);
}

writeFileSync(appPath, source);

const edgePath = "src/edgeDetect.ts";
if (existsSync(edgePath)) {
  let edge = readFileSync(edgePath, "utf8");
  edge = edge.replace(
`  const accepted: CellCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.35;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 12) break;
  }

  const merged = mergeNearbyPaneBoxes(accepted, projectionZone);
  return merged.sort((a, b) => b.score - a.score).slice(0, 6);`,
`  const accepted: CellCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const aspect = candidate.width / Math.max(candidate.height, 0.01);
    if (aspect < 0.45 || aspect > 2.7) continue;
    const duplicate = accepted.some((existing) => {
      const overlap = overlapAmount(existing, candidate);
      const minArea = Math.min(existing.width * existing.height, candidate.width * candidate.height);
      return overlap / Math.max(minArea, 1) > 0.42;
    });
    if (!duplicate) accepted.push(candidate);
    if (accepted.length >= 16) break;
  }

  const merged = mergeNearbyPaneBoxes(accepted, projectionZone);
  const candidatesByArea = merged
    .filter((box) => {
      const aspect = box.width / Math.max(box.height, 0.01);
      const tooWideForOneObject = box.width > projectionZone.width * 0.42 && box.height < projectionZone.height * 0.34;
      const tooFlat = box.height < projectionZone.height * 0.15;
      const tooTallSkinny = box.width < projectionZone.width * 0.09;
      return aspect >= 0.48 && aspect <= 2.45 && !tooWideForOneObject && !tooFlat && !tooTallSkinny;
    })
    .sort((a, b) => (b.width * b.height) - (a.width * a.height) || b.score - a.score);

  const cleaned: CellCandidate[] = [];
  for (const candidate of candidatesByArea) {
    const candidateArea = candidate.width * candidate.height;
    const duplicateOrFragment = cleaned.some((existing) => {
      const existingArea = existing.width * existing.height;
      const overlap = overlapAmount(existing, candidate);
      const overlapCandidate = overlap / Math.max(candidateArea, 1);
      const overlapExisting = overlap / Math.max(existingArea, 1);
      const closeCenters = Math.abs((existing.x + existing.width / 2) - (candidate.x + candidate.width / 2)) < projectionZone.width * 0.035 && Math.abs((existing.y + existing.height / 2) - (candidate.y + candidate.height / 2)) < projectionZone.height * 0.035;
      return overlapCandidate > 0.38 || overlapExisting > 0.72 || closeCenters;
    });
    if (!duplicateOrFragment) cleaned.push(candidate);
    if (cleaned.length >= 4) break;
  }

  return cleaned.sort((a, b) => b.score - a.score).slice(0, 4);`
  );
  writeFileSync(edgePath, edge);
}
