import { readFileSync, writeFileSync } from "node:fs";

const path = "styles.css";
let css = readFileSync(path, "utf8");

const patch = `

/* Mobile Start page overflow guard: unloaded Start screen only */
@media(max-width:960px){
  html,body,#root{max-width:100vw!important;overflow-x:hidden!important;}
  .appShell,.glowcastApp{max-width:100vw!important;width:100%!important;overflow-x:hidden!important;}
  .startPage{display:block!important;width:100%!important;max-width:100vw!important;min-width:0!important;overflow:hidden!important;margin:8px 0 0!important;padding:0 8px!important;}
  .startPage .toolPanel,.startPage .startSetupPanel{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;overflow:hidden!important;padding:12px!important;border-radius:18px!important;}
  .startPage .panelBlock{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
  .startPage .uploadButton,.startPage .toolPanel button{width:100%!important;max-width:100%!important;min-width:0!important;white-space:normal!important;text-align:center!important;}
  .startPage .recentPhotoBlock{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
  .startPage .recentPhotoRow{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;scrollbar-width:thin;}
  .startPage .recentPhotoButton{flex:0 0 86px!important;min-width:86px!important;max-width:86px!important;}
  .startPage .recentPhotoButton img{width:100%!important;height:52px!important;object-fit:cover!important;}
  .startPage .recentHeader{width:100%!important;min-width:0!important;}
}
`;

if (!css.includes("Mobile Start page overflow guard")) {
  css += patch;
}

writeFileSync(path, css);
