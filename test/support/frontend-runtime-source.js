import { readFileSync } from "node:fs";

const runtimeModules = [
  "../../apps/web/src/app/applicationRuntime.ts",
  "../../apps/web/src/features/countrySetup/countryExperienceController.js",
  "../../apps/web/src/features/explorer/explorerController.js",
  "../../apps/web/src/features/artwork/artworkController.js",
  "../../apps/web/src/app/browserRuntime.ts"
];

export function readFrontendRuntimeSource() {
  return runtimeModules
    .map((modulePath) => readFileSync(new URL(modulePath, import.meta.url), "utf8"))
    .join("\n");
}
