import { readFileSync } from "node:fs";

export type MutableEnvironment =
  Record<string, string | undefined>;

const ENVIRONMENT_KEY_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Loads a local dotenv-style file without overwriting values already supplied
 * by the process. Blank values are preserved so isolated test processes can
 * explicitly disable provider credentials.
 */
export function loadLocalEnv(
  filePath: string,
  environment: MutableEnvironment = process.env
): void {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("#") ||
      !line.includes("=")
    ) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line
      .slice(0, separatorIndex)
      .trim();
    if (!ENVIRONMENT_KEY_PATTERN.test(key)) {
      continue;
    }
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!Object.hasOwn(environment, key)) {
      environment[key] = value;
    }
  }
}
