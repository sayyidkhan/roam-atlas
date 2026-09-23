import {
  appendFile,
  mkdir,
  readFile
} from "node:fs/promises";
import path from "node:path";

import {
  UsageRecordSchema,
  type UsageRecord
} from "@roamatlas/contracts/usageContract.js";

const MAX_USAGE_RECORDS = 500;

export function createUsageRepository({
  runtimeCacheRoot
}: {
  runtimeCacheRoot: string;
}) {
  const usageDirectory = path.join(runtimeCacheRoot, "usage");
  const usageFile = path.join(usageDirectory, "records.jsonl");
  let writeChain = Promise.resolve();

  function append(record: UsageRecord): Promise<void> {
    const operation = writeChain.then(async () => {
      await mkdir(usageDirectory, { recursive: true });
      await appendFile(
        usageFile,
        `${JSON.stringify(record)}\n`,
        "utf8"
      );
    });
    writeChain = operation.catch(() => undefined);
    return operation;
  }

  async function list(): Promise<UsageRecord[]> {
    await writeChain;
    let contents: string;
    try {
      contents = await readFile(usageFile, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) return [];
      throw error;
    }
    return contents
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-MAX_USAGE_RECORDS)
      .flatMap((line) => {
        try {
          const parsed = UsageRecordSchema.safeParse(
            JSON.parse(line)
          );
          return parsed.success ? [parsed.data] : [];
        } catch {
          return [];
        }
      })
      .reverse();
  }

  return { append, list };
}

function isMissingFileError(
  error: unknown
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
