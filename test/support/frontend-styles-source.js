import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(
  new URL("../../apps/web/src/", import.meta.url)
);

export function readFrontendStylesSource() {
  return collectCssFiles(frontendRoot)
    .sort((left, right) => left.localeCompare(right))
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");
}

function collectCssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
  });
}
