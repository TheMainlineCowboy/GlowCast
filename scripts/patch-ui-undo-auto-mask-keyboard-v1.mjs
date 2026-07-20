import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

if (!source.includes('event.key.toLowerCase() === "u"')) {
  const rejectBranch = `      } else if (event.key.toLowerCase() === "r" || event.key === "Delete" || event.key === "Backspace") {\n        event.preventDefault();\n        rejectSelectedAutoMask();\n      }`;
  const replacement = `      } else if (event.key.toLowerCase() === "r" || event.key === "Delete" || event.key === "Backspace") {\n        event.preventDefault();\n        rejectSelectedAutoMask();\n      } else if (event.key.toLowerCase() === "u" && lastRejectedAutoMask) {\n        event.preventDefault();\n        undoLastAutoMaskRejection();\n      }`;
  if (!source.includes(rejectBranch)) throw new Error("Automatic mask keyboard rejection branch not found.");
  source = source.replace(rejectBranch, replacement);
}

source = source.replace(
  "  }, [zones, selectedZoneId]);",
  "  }, [zones, selectedZoneId, lastRejectedAutoMask]);"
);

source = source.replace(
  "Keyboard: A approve · R/Delete reject",
  "Keyboard: A approve · R/Delete reject · U undo"
);

await fs.writeFile(path, source);
console.log("Added U shortcut for undoing the last automatic-mask rejection.");
