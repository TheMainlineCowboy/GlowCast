import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

let sourcePrepRan = false;

function runSourcePrepOnce() {
  if (sourcePrepRan) return;
  sourcePrepRan = true;
  execFileSync("node", ["scripts/source-prep.mjs"], { stdio: "inherit" });
}

export default defineConfig({
  plugins: [
    {
      name: "glowcast-source-prep",
      enforce: "pre",
      buildStart() {
        runSourcePrepOnce();
      },
      configureServer() {
        runSourcePrepOnce();
      }
    },
    react()
  ]
});
