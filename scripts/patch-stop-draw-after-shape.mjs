import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

const needle = '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n  }';
const replacement = '    setSelectedTarget("zone");\n    setSelectedZoneId(id);\n    setDrawMode(false);\n  }';

source = source.replace(needle, replacement);

writeFileSync(path, source);
