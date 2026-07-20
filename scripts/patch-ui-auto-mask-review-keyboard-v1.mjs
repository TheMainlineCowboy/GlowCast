import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

if (!source.includes("Auto-mask review keyboard shortcuts")) {
  const marker = "const rejectSelectedAutoMask = () => {";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Reject-and-advance action anchor not found.");

  const nextFunction = source.indexOf("\n  };", start);
  if (nextFunction < 0) throw new Error("Reject-and-advance action end not found.");
  const insertionPoint = nextFunction + "\n  };".length;

  const keyboardEffect = `\n\n  // Auto-mask review keyboard shortcuts\n  useEffect(() => {\n    const handleAutoMaskReviewKey = (event: KeyboardEvent) => {\n      const target = event.target as HTMLElement | null;\n      if (target?.closest(\"input, textarea, select, [contenteditable='true']\")) return;\n      const selectedAutoMask = zones.some((zone) =>\n        zone.id === selectedZoneId &&\n        (zone.label ?? \"\").startsWith(\"Auto architectural mask\") &&\n        !zone.included\n      );\n      if (!selectedAutoMask || event.altKey || event.ctrlKey || event.metaKey) return;\n      if (event.key.toLowerCase() === \"a\") {\n        event.preventDefault();\n        approveSelectedAutoMask();\n      } else if (event.key.toLowerCase() === \"r\" || event.key === \"Delete\" || event.key === \"Backspace\") {\n        event.preventDefault();\n        rejectSelectedAutoMask();\n      }\n    };\n    window.addEventListener(\"keydown\", handleAutoMaskReviewKey);\n    return () => window.removeEventListener(\"keydown\", handleAutoMaskReviewKey);\n  }, [zones, selectedZoneId]);\n`;

  source = source.slice(0, insertionPoint) + keyboardEffect + source.slice(insertionPoint);
}

if (!source.includes("Keyboard: A approve · R/Delete reject")) {
  const buttonMarker = "Reject & Review Next Auto Mask\n              </button>";
  const buttonIndex = source.indexOf(buttonMarker);
  if (buttonIndex < 0) throw new Error("Reject-and-advance button label anchor not found.");
  const insertionPoint = buttonIndex + buttonMarker.length;
  const hint = `\n              <small className=\"autoMaskReviewShortcutHint\" aria-label=\"Automatic mask review keyboard shortcuts\">Keyboard: A approve · R/Delete reject</small>`;
  source = source.slice(0, insertionPoint) + hint + source.slice(insertionPoint);
}

await fs.writeFile(path, source);
console.log("Applied automatic-mask review keyboard shortcuts source patch.");
