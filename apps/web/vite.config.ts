import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webPort = Number(process.env.WEB_PORT ?? 4150);
const apiPort = Number(process.env.PORT ?? 4151);

export default defineConfig({
  plugins: [react()],
  publicDir: "../../public",
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
      "/runtime-cache": `http://127.0.0.1:${apiPort}`
    }
  }
});
