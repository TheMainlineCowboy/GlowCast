import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const confirmationMarker = "Remove overlapping masks? GlowCast will keep the stronger mask from each pair.";

if (!source.includes(confirmationMarker)) {
  const anchor = `  const removeOverlappingAutoMasks = () => {\n    if (overlappingAutoMaskIds.size === 0) return;`;
  if (!source.includes(anchor)) {
    throw new Error("Overlap cleanup handler anchor not found.");
  }

  const replacement = `  const removeOverlappingAutoMasks = () => {\n    if (overlappingAutoMaskIds.size === 0) return;\n    const confirmed = window.confirm(\n      \`Remove overlapping masks? GlowCast will keep the stronger mask from each pair. \\${overlappingAutoMaskIds.size} mask\\${overlappingAutoMaskIds.size === 1 ? "" : "s"} will be removed.\`\n    );\n    if (!confirmed) {\n      setDetectMessage("Overlap cleanup canceled. No masks were removed.");\n      return;\n    }`;

  source = source.replace(anchor, replacement);
}

await fs.writeFile(path, source);
console.log("Applied overlap cleanup confirmation.");
