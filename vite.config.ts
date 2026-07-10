import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const buildSha =
  process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ??
  process.env.GITHUB_SHA?.slice(0, 7) ??
  "local";

// Cloudflare runs `npm run build`, and the build script performs source prep
// before TypeScript and Vite. Keep Vite side-effect free so prep only runs once.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "glowcast-build-stamp",
      transformIndexHtml(html) {
        return html.replaceAll("__GLOWCAST_BUILD__", buildSha);
      }
    }
  ]
});
