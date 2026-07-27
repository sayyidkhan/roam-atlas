import { defineConfig } from "@playwright/test";

const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "4150";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "4151";
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      EXA_API_KEY: "",
      WEB_PORT: webPort,
      PORT: apiPort,
      ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY: "0"
    }
  }
});
