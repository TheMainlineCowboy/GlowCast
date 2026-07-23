import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const marker = 'data-auto-mask-confidence-overlay';
if (source.includes(marker)) {
  console.log("Automatic-mask confidence overlay already present.");
  process.exit(0);
}

const anchor = "              <span>{index + 1}</span>";
if (!source.includes(anchor)) {
  throw new Error("Unable to locate zone number badge for confidence overlay.");
}

const overlay = `${anchor}\n              {selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence ? (\n                <b\n                  data-auto-mask-confidence-overlay\n                  title={\`GlowCast confidence: \${selectedAutoMaskConfidence}\`}\n                  style={{\n                    position: "absolute",\n                    top: 8,\n                    right: 8,\n                    zIndex: 12,\n                    padding: "4px 8px",\n                    borderRadius: 999,\n                    background: selectedAutoMaskConfidence === "Strong" ? "rgba(20,83,45,.92)" : selectedAutoMaskConfidence === "Weak" ? "rgba(127,29,29,.92)" : "rgba(120,53,15,.92)",\n                    color: "white",\n                    fontSize: 11,\n                    fontWeight: 800,\n                    letterSpacing: ".04em",\n                    boxShadow: "0 2px 10px rgba(0,0,0,.45)",\n                    pointerEvents: "none"\n                  }}\n                >\n                  {selectedAutoMaskConfidence}\n                </b>\n              ) : null}`;

source = source.replace(anchor, overlay);
await fs.writeFile(path, source);
console.log("Added selected automatic-mask confidence directly to the mask overlay.");
