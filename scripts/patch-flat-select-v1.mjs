import { readFileSync, writeFileSync } from "node:fs";

const p = "src/App.tsx";
let s = readFileSync(p, "utf8");

s = s.replace(
  '<div key={zone.id + "-flat-view-" + index} className={"flattenPreviewMask " + shapeClass(zone.shape)} style={toStyle(zone)}><span>{index + 1}</span></div>',
  '<button type="button" key={zone.id + "-flat-view-" + index} className={"flattenPreviewMask flatPreviewSelectable " + shapeClass(zone.shape) + (selectedZoneId === zone.id ? " selectedFlatMask" : "")} style={toStyle(zone)} onClick={() => { setSelectedTarget("zone"); setSelectedZoneId(zone.id); }}><span>{index + 1}</span></button>'
);

s = s.replace(
  '<p className="helperText">Read-only flattened surface view. Mask editing stays on Page 2 for now.</p>',
  '{selectedZone ? <div className="flatSelectionBox"><strong>Selected Mask {zones.findIndex((zone) => zone.id === selectedZone.id) + 1}</strong><span>{selectedZone.shape ?? "rectangle"}</span><button type="button" onClick={() => { setSelectedTarget("zone"); setSelectedZoneId(selectedZone.id); setStep("mask"); }}>Edit This Mask on Page 2</button></div> : <p className="helperText">Tap a mask overlay to select it.</p>}'
);

writeFileSync(p, s);

const c = "styles.css";
let css = readFileSync(c, "utf8");
if (!css.includes("flatPreviewSelectable")) css += "\n.flatPreviewSelectable{pointer-events:auto!important;cursor:pointer!important;padding:0!important;margin:0!important}.selectedFlatMask{border-color:#67e8f9!important;box-shadow:0 0 0 3px rgba(103,232,249,.55),0 0 24px rgba(103,232,249,.5)!important}.flatSelectionBox{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(103,232,249,.35);border-radius:14px;background:rgba(2,6,23,.45)}.flatSelectionBox span{color:#94a3b8;font-size:12px}\n";
writeFileSync(c, css);
