import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Transitional web build. The current Node server stays responsible for API
 * behavior while browser modules migrate feature by feature into TypeScript.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/web",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4151",
      "/runtime-cache": "http://127.0.0.1:4151"
    }
  }
});
