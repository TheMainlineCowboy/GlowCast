import { readFileSync, writeFileSync } from "node:fs";

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
