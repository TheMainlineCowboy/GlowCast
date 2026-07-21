import fs from "node:fs/promises";

const path = "src/core/architecturalDetector.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const broadDirectionalTexture";
if (!source.includes(marker)) {
  const anchor = `    const totalStructural = component.horizontalStrength + component.verticalStrength;\n    if (totalStructural > 0) {\n      const balanceRatio =\n        Math.min(component.horizontalStrength, component.verticalStrength) /\n        Math.max(component.horizontalStrength, component.verticalStrength);\n      score += Math.floor(balanceRatio * 20);\n    }\n`;

  if (!source.includes(anchor)) {
    throw new Error("Architectural structural-balance anchor not found.");
  }

  const replacement = `    const totalStructural = component.horizontalStrength + component.verticalStrength;\n    const structuralBalance =\n      totalStructural > 0\n        ? Math.min(component.horizontalStrength, component.verticalStrength) /\n          Math.max(component.horizontalStrength, component.verticalStrength)\n        : 0;\n    const componentAreaPercent = wPct * hPct;\n    const broadDirectionalTexture = componentAreaPercent >= 1200 && structuralBalance < 0.08;\n\n    // Broad reflections, siding bands, and wall texture often produce a large connected\n    // component with strong evidence in only one direction. Real windows and doors keep\n    // meaningful horizontal and vertical structure even when one edge is softened.\n    if (broadDirectionalTexture) {\n      diagnostics.rejectedConfidence += 1;\n      return;\n    }\n\n    if (totalStructural > 0) {\n      score += Math.floor(structuralBalance * 20);\n    }\n`;

  source = source.replace(anchor, replacement);
  await fs.writeFile(path, source);
}

console.log("broad directional texture rejection ready");
