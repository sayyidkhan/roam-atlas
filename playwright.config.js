import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:4150",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4150",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      EXA_API_KEY: "",
      ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY: "0"
    }
  }
});
