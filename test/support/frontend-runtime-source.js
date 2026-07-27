import { readFileSync } from "node:fs";

const runtimeModules = [
  "../../src/app/applicationRuntime.ts",
  "../../src/features/countrySetup/countryExperienceController.js",
  "../../src/features/explorer/explorerController.js",
  "../../src/features/artwork/artworkController.js",
  "../../src/app/browserRuntime.ts"
];

export function readFrontendRuntimeSource() {
  return runtimeModules
    .map((modulePath) => readFileSync(new URL(modulePath, import.meta.url), "utf8"))
    .join("\n");
}
