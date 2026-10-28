import { defineConfig } from "vitest/config";
import appPackage from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appPackage.version) }
});
