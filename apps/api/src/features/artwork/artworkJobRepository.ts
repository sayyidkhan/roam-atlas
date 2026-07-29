import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  isPathInside
} from "../../platform/runtime/runtimeCacheFiles.ts";

export type ArtworkJobRecord =
  Record<string, unknown> & {
    status?: unknown;
  };

export type ArtworkJobFile = {
  fileName: string;
  jobPath: string;
};

type ArtworkJobRepositoryOptions = {
  assertJobWritable: (
    jobPath: string
  ) => unknown;
  runtimeCacheRoot: string;
};

export function createArtworkJobRepository({
  runtimeCacheRoot,
  assertJobWritable
}: ArtworkJobRepositoryOptions) {
  const terminalJobs = new Set<string>();

  async function writeJob(
    jobPath: string,
    job: ArtworkJobRecord
  ): Promise<void> {
    assertSafeRuntimePath(jobPath);
    assertJobWritable(jobPath);
    await mkdir(path.dirname(jobPath), {
      recursive: true
    });
    const temporaryPath =
      `${jobPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(
          {
            ...job,
            updatedAt: new Date().toISOString()
          },
          null,
          2
        )}\n`
      );
      assertJobWritable(jobPath);
      await rename(temporaryPath, jobPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    markTerminal(jobPath, job.status);
  }

  async function readJob(
    jobPath: string
  ): Promise<ArtworkJobRecord | null> {
    assertSafeRuntimePath(jobPath);
    return readJson(jobPath);
  }

  async function readMetadata(
    metadataPath: string
  ): Promise<ArtworkJobRecord | null> {
    assertSafeRuntimePath(metadataPath);
    return readJson(metadataPath);
  }

  async function readEnvironment(
    environmentPath: string
  ): Promise<ArtworkJobRecord | null> {
    assertSafeRuntimePath(environmentPath);
    return readJson(environmentPath);
  }

  async function writeBinaryArtifact(
    artifactPath: string,
    bytes: Uint8Array | string,
    jobPath = artifactPath
  ): Promise<void> {
    assertSafeRuntimePath(artifactPath);
    assertJobWritable(jobPath);
    await mkdir(path.dirname(artifactPath), {
      recursive: true
    });
    await writeFile(artifactPath, bytes);
    assertJobWritable(jobPath);
  }

  async function writeJsonArtifact(
    artifactPath: string,
    payload: unknown,
    jobPath = artifactPath
  ): Promise<void> {
    await writeBinaryArtifact(
      artifactPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      jobPath
    );
  }

  async function isFileAvailable(
    filePath: string
  ): Promise<boolean> {
    assertSafeRuntimePath(filePath);
    try {
      return (await stat(filePath)).isFile();
    } catch {
      return false;
    }
  }

  async function listJobFiles():
  Promise<ArtworkJobFile[]> {
    await mkdir(runtimeCacheRoot, {
      recursive: true
    });
    const jobFiles: ArtworkJobFile[] = [];
    jobFiles.push(
      ...(await collectJobFiles({
        jobDirectory: path.join(
          runtimeCacheRoot,
          "image-jobs"
        ),
        fileNamePrefix: "legacy"
      }))
    );

    const entries = await readdir(
      runtimeCacheRoot,
      { withFileTypes: true }
    );
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === "image-jobs"
      ) {
        continue;
      }
      jobFiles.push(
        ...(await collectJobFiles({
          jobDirectory: path.join(
            runtimeCacheRoot,
            entry.name,
            "image-jobs"
          ),
          fileNamePrefix: entry.name
        }))
      );
    }
    return jobFiles.sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    );
  }

  function isTerminal(
    jobPath: string
  ): boolean {
    return terminalJobs.has(jobPath);
  }

  function markTerminal(
    jobPath: string,
    status: unknown
  ): void {
    if (
      status === "ready" ||
      status === "failed"
    ) {
      terminalJobs.add(jobPath);
    } else {
      terminalJobs.delete(jobPath);
    }
  }

  function clearTerminalUnder(
    cacheRoot: string
  ): void {
    for (const jobPath of terminalJobs) {
      if (
        isPathInside(
          cacheRoot,
          path.normalize(jobPath)
        )
      ) {
        terminalJobs.delete(jobPath);
      }
    }
  }

  function assertSafeRuntimePath(
    filePath: string
  ): void {
    if (
      !isPathInside(
        runtimeCacheRoot,
        path.normalize(filePath)
      )
    ) {
      throw new Error(
        "Artwork job path is outside the runtime cache."
      );
    }
  }

  return {
    writeJob,
    readJob,
    readMetadata,
    readEnvironment,
    writeBinaryArtifact,
    writeJsonArtifact,
    isFileAvailable,
    listJobFiles,
    isTerminal,
    markTerminal,
    clearTerminalUnder
  };
}

export type ArtworkJobRepository = ReturnType<
  typeof createArtworkJobRepository
>;

async function readJson(
  filePath: string
): Promise<ArtworkJobRecord | null> {
  try {
    const value = JSON.parse(
      await readFile(filePath, "utf8")
    ) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

async function collectJobFiles({
  jobDirectory,
  fileNamePrefix
}: {
  fileNamePrefix: string;
  jobDirectory: string;
}): Promise<ArtworkJobFile[]> {
  let entries: string[];
  try {
    entries = await readdir(jobDirectory);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => ({
      fileName: `${fileNamePrefix}/${entry}`,
      jobPath: path.join(jobDirectory, entry)
    }));
}

function isRecord(
  value: unknown
): value is ArtworkJobRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
