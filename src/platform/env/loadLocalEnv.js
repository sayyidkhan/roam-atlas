import { readFileSync } from "node:fs";

/**
 * Loads a local dotenv-style file without overwriting values already supplied
 * by the process. Blank values are preserved so isolated test processes can
 * explicitly disable provider credentials.
 */
export function loadLocalEnv(filePath, environment = process.env) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!Object.hasOwn(environment, key)) {
      environment[key] = value;
    }
  }
}
