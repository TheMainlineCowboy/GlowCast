import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const stateMarker = "  const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {";
if (!source.includes("swappedOverlapRemovalIds")) {
  if (!source.includes(stateMarker)) throw new Error("Overlap helper anchor not found for swap state.");
  source = source.replace(
    stateMarker,
    `  const [swappedOverlapRemovalIds, setSwappedOverlapRemovalIds] = useState<Set<number>>(() => new Set());\n\n${stateMarker}`
  );
}

const assignmentMarker = `  const {\n    duplicateIds: overlappingAutoMaskIds,\n    retainedIds: retainedOverlappingAutoMaskIds,\n    retainedByDuplicateId: retainedOverlapByRemovedId\n  } = findOverlappingAutoMaskIds(zones);`;
if (!source.includes("detectedOverlapByRemovedId")) {
  if (!source.includes(assignmentMarker)) throw new Error("Overlap assignment anchor not found for effective swap pairs.");
  const replacement = [
    "  const {",
    "    retainedByDuplicateId: detectedOverlapByRemovedId",
    "  } = findOverlappingAutoMaskIds(zones);",
    "  const retainedOverlapByRemovedId = new Map<number, number>();",
    "  for (const [detectedRemoveId, detectedKeepId] of detectedOverlapByRemovedId) {",
    "    if (swappedOverlapRemovalIds.has(detectedRemoveId)) {",
    "      retainedOverlapByRemovedId.set(detectedKeepId, detectedRemoveId);",
    "    } else {",
    "      retainedOverlapByRemovedId.set(detectedRemoveId, detectedKeepId);",
    "    }",
    "  }",
    "  const overlappingAutoMaskIds = new Set(retainedOverlapByRemovedId.keys());",
    "  const retainedOverlappingAutoMaskIds = new Set(retainedOverlapByRemovedId.values());"
  ].join("\n");
  source = source.replace(assignmentMarker, replacement);
}

if (!source.includes("const swapSelectedOverlapDecision = () =>")) {
  const exitMarker = "  const exitOverlappingAutoMaskReview = () => {";
  const exitIndex = source.indexOf(exitMarker);
  if (exitIndex < 0) throw new Error("Overlap exit helper anchor not found for swap action.");
  const swapHelper = [
    "  const swapSelectedOverlapDecision = () => {",
    "    if (selectedZoneId === null) return;",
    "    const detectedPair = Array.from(detectedOverlapByRemovedId.entries()).find(",
    "      ([detectedRemoveId, detectedKeepId]) => detectedRemoveId === selectedZoneId || detectedKeepId === selectedZoneId",
    "    );",
    "    if (!detectedPair) return;",
    "    const [detectedRemoveId, detectedKeepId] = detectedPair;",
    "    const currentlySwapped = swappedOverlapRemovalIds.has(detectedRemoveId);",
    "    setSwappedOverlapRemovalIds((current) => {",
    "      const next = new Set(current);",
    "      if (currentlySwapped) next.delete(detectedRemoveId);",
    "      else next.add(detectedRemoveId);",
    "      return next;",
    "    });",
    "    setSelectedZoneId(currentlySwapped ? detectedRemoveId : detectedKeepId);",
    "    setDetectMessage(\"Swapped this overlap pair. The red REMOVE mask and green KEEP mask have been reversed.\");",
    "  };",
    "",
    ""
  ].join("\n");
  source = source.slice(0, exitIndex) + swapHelper + source.slice(exitIndex);
}

if (!source.includes("Swap Keep / Remove")) {
  const exitButtonStart = source.indexOf('onClick={exitOverlappingAutoMaskReview}');
  const exitButtonEnd = source.indexOf("</button>", exitButtonStart);
  if (exitButtonStart < 0 || exitButtonEnd < 0) throw new Error("Exit review button anchor not found for swap control.");
  const insertionIndex = exitButtonEnd + "</button>".length;
  const swapButton = `\n              <button type="button" onClick={swapSelectedOverlapDecision} disabled={selectedZoneId === null || !overlappingAutoMaskIds.has(selectedZoneId)} aria-label="Swap which mask is kept and removed for the selected overlap pair">\n                Swap Keep / Remove\n              </button>`;
  source = source.slice(0, insertionIndex) + swapButton + source.slice(insertionIndex);
}

await fs.writeFile(path, source);
console.log("Applied user-controlled keep/remove swapping for overlap review pairs.");
