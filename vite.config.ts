import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Cloudflare runs `npm run build`, and the build script performs source prep
// before TypeScript and Vite. Keep Vite side-effect free so prep only runs once.
export default defineConfig({
  plugins: [react()]
});
