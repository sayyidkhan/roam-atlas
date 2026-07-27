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

import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.js";

export function createArtworkJobRepository({
  runtimeCacheRoot,
  assertJobWritable
}) {
  const terminalJobs = new Set();

  async function writeJob(jobPath, job) {
    assertSafeRuntimePath(jobPath);
    assertJobWritable(jobPath);
    await mkdir(path.dirname(jobPath), { recursive: true });
    const temporaryPath =
      `${jobPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(
          { ...job, updatedAt: new Date().toISOString() },
          null,
          2
        )}\n`
      );
      assertJobWritable(jobPath);
      await rename(temporaryPath, jobPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    markTerminal(jobPath, job?.status);
  }

  async function readJob(jobPath) {
    assertSafeRuntimePath(jobPath);
    return readJson(jobPath);
  }

  async function readMetadata(metadataPath) {
    assertSafeRuntimePath(metadataPath);
    return readJson(metadataPath);
  }

  async function readEnvironment(environmentPath) {
    assertSafeRuntimePath(environmentPath);
    return readJson(environmentPath);
  }

  async function writeBinaryArtifact(
    artifactPath,
    bytes,
    jobPath = artifactPath
  ) {
    assertSafeRuntimePath(artifactPath);
    assertJobWritable(jobPath);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, bytes);
    assertJobWritable(jobPath);
  }

  async function writeJsonArtifact(
    artifactPath,
    payload,
    jobPath = artifactPath
  ) {
    await writeBinaryArtifact(
      artifactPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      jobPath
    );
  }

  async function isFileAvailable(filePath) {
    assertSafeRuntimePath(filePath);
    try {
      return (await stat(filePath)).isFile();
    } catch {
      return false;
    }
  }

  async function listJobFiles() {
    await mkdir(runtimeCacheRoot, { recursive: true });
    const jobFiles = [];
    jobFiles.push(...await collectJobFiles({
      jobDirectory: path.join(runtimeCacheRoot, "image-jobs"),
      fileNamePrefix: "legacy"
    }));

    const entries = await readdir(runtimeCacheRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "image-jobs") continue;
      jobFiles.push(...await collectJobFiles({
        jobDirectory: path.join(
          runtimeCacheRoot,
          entry.name,
          "image-jobs"
        ),
        fileNamePrefix: entry.name
      }));
    }
    return jobFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  function isTerminal(jobPath) {
    return terminalJobs.has(jobPath);
  }

  function markTerminal(jobPath, status) {
    if (["ready", "failed"].includes(status)) {
      terminalJobs.add(jobPath);
    } else {
      terminalJobs.delete(jobPath);
    }
  }

  function clearTerminalUnder(cacheRoot) {
    for (const jobPath of [...terminalJobs]) {
      if (isPathInside(cacheRoot, path.normalize(jobPath))) {
        terminalJobs.delete(jobPath);
      }
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

  function assertSafeRuntimePath(filePath) {
    if (!isPathInside(runtimeCacheRoot, path.normalize(filePath))) {
      throw new Error("Artwork job path is outside the runtime cache.");
    }
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function collectJobFiles({ jobDirectory, fileNamePrefix }) {
  let entries;
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
