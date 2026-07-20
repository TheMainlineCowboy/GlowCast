import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredSnippets = [
  "const rejectSelectedAutoMask = () => {",
  "currentZones.filter((zone) => zone.id !== selectedAutoMask.id)",
  "setSelectedZoneId(nextAutoMask?.id ?? null)",
  "Reject & Review Next Auto Mask",
  'aria-label="Delete the selected automatic mask and review the next disabled automatic mask"',
  "Rejected automatic mask.",
  "Review complete."
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Reject-and-advance UI regression missing: ${snippet}`);
  }
}

if (!source.includes("disabled={!zones.some((zone) => zone.id === selectedZoneId")) {
  throw new Error("Reject action must remain disabled unless a reviewable automatic mask is selected.");
}

console.log("Selected automatic-mask reject-and-advance UI smoke passed.");
