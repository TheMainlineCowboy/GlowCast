import fs from "node:fs/promises";

const path = "src/App.tsx";
let source = await fs.readFile(path, "utf8");

const oldMessage = '    setDetectMessage(`Reviewing overlap candidate ${currentIndex + 2 > overlapCandidates.length ? 1 : currentIndex + 2} of ${overlapCandidates.length}.`);';
const newMessage = '    setDetectMessage(`Reviewing overlap candidate ${currentIndex + 2 > overlapCandidates.length ? 1 : currentIndex + 2} of ${overlapCandidates.length}. Red REMOVE will be discarded; green KEEP will remain.`);';

if (!source.includes("Red REMOVE will be discarded; green KEEP will remain.")) {
  if (!source.includes(oldMessage)) {
    throw new Error("Overlap review status-message anchor not found.");
  }
  source = source.replace(oldMessage, newMessage);
}

await fs.writeFile(path, source);
console.log("Applied explicit keep/remove overlap review guidance.");
