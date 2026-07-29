import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { createPlaceImageCachePaths } from "../../domain/runtimeCache.ts";
import { isPathInside } from "../../platform/runtime/runtimeCacheFiles.ts";
import { PLACE_IMAGE_HISTORY_LIMIT } from "./placeImageHistoryPolicy.ts";
import type {
  PlaceImageHistoryRecord,
  PlaceImagePaths,
  PlaceImageRecord,
  PlaceImageRepository
} from "./placeImageServiceTypes.ts";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

type PlaceImageHistoryManifest = {
  countrySlug: string;
  entries: PlaceImageHistoryRecord[];
  place: string;
};

type PlaceImageRepositoryOptions = {
  cacheRoot: string;
  getImagePathFromUrl: (imageUrl: string) => string | null;
  selectionVersion: string;
  logger?: Pick<Console, "warn">;
};

export function createPlaceImageRepository({
  cacheRoot,
  getImagePathFromUrl,
  selectionVersion,
  logger = console
}: PlaceImageRepositoryOptions): PlaceImageRepository {
  function pathsFor(countrySlug: string, place: string): PlaceImagePaths {
    const paths = createPlaceImageCachePaths({
      cacheRoot,
      countrySlug,
      place
    }) as PlaceImagePaths;
    assertSafeCountryPath(paths.countryCacheRoot, countrySlug);
    return paths;
  }

  async function readMetadata(
    paths: PlaceImagePaths
  ): Promise<PlaceImageRecord | null> {
    try {
      return toPlaceImageRecord(
        JSON.parse(await readFile(paths.metadataPath, "utf8")) as unknown
      );
    } catch {
      return null;
    }
  }

  async function writeMetadata(
    paths: PlaceImagePaths,
    record: PlaceImageRecord
  ): Promise<void> {
    try {
      await mkdir(path.dirname(paths.metadataPath), { recursive: true });
      await writeFile(paths.metadataPath, JSON.stringify(record, null, 2));
    } catch (error) {
      logger.warn(
        `Place image metadata write failed for ${record.place ?? "unknown place"}: ${errorMessage(error)}`
      );
    }
  }

  async function readStoredRecord(
    paths: PlaceImagePaths
  ): Promise<PlaceImageRecord | null> {
    const record = await readMetadata(paths);
    if (!record || record.selectionVersion !== selectionVersion) return null;
    if (!record.imageUrl) return record;

    const imagePath = getImagePathFromUrl(record.imageUrl);
    if (!imagePath || !isPathInside(paths.countryCacheRoot, imagePath)) {
      return null;
    }
    try {
      await stat(imagePath);
      return record;
    } catch {
      return null;
    }
  }

  async function readCachedImage(
    imageUrl: string
  ): Promise<{ bytes: Buffer; filePath: string } | null> {
    const imagePath = getImagePathFromUrl(imageUrl);
    if (!imagePath || !isPathInside(cacheRoot, path.normalize(imagePath))) {
      return null;
    }
    try {
      return {
        filePath: imagePath,
        bytes: await readFile(imagePath)
      };
    } catch {
      return null;
    }
  }

  async function listStoredRecords(
    countryCacheRoot: string
  ): Promise<PlaceImageRecord[]> {
    try {
      const directory = path.join(countryCacheRoot, "place-images");
      const files = (await readdir(directory)).filter(
        (file) =>
          file.endsWith(".json") && !file.endsWith(".history.json")
      );
      const records: PlaceImageRecord[] = [];
      for (const file of files) {
        try {
          const record = toPlaceImageRecord(
            JSON.parse(
              await readFile(path.join(directory, file), "utf8")
            ) as unknown
          );
          if (record) records.push(record);
        } catch {
          // Ignore corrupt or half-written place-image metadata.
        }
      }
      return records;
    } catch {
      return [];
    }
  }

  async function removeCountry(countrySlug: string): Promise<void> {
    const countryCacheRoot = path.normalize(path.join(cacheRoot, countrySlug));
    const placeImagesRoot = path.normalize(
      path.join(countryCacheRoot, "place-images")
    );
    assertSafeCountryPath(countryCacheRoot, countrySlug);
    if (!isPathInside(countryCacheRoot, placeImagesRoot)) {
      throw new Error(`Unsafe place image cache path for ${countrySlug}.`);
    }
    await rm(placeImagesRoot, { recursive: true, force: true });
  }

  async function removePlace(
    paths: PlaceImagePaths,
    { preserveHistory = false }: { preserveHistory?: boolean } = {}
  ): Promise<{
    archived: PlaceImageRecord | null;
    imagePaths: string[];
    record: PlaceImageRecord | null;
  }> {
    const record = await readMetadata(paths);
    const archived = preserveHistory ? await archive(paths, record) : null;
    const imagePaths = activeImagePaths(paths);
    await Promise.all([
      rm(paths.metadataPath, { force: true }),
      ...imagePaths.map((imagePath) => rm(imagePath, { force: true })),
      ...(preserveHistory
        ? []
        : [
            rm(paths.historyMetadataPath, { force: true }),
            rm(paths.historyRoot, { recursive: true, force: true })
          ])
    ]);
    return { record, archived, imagePaths };
  }

  async function archive(
    paths: PlaceImagePaths,
    record: PlaceImageRecord | null
  ): Promise<PlaceImageHistoryRecord | null> {
    if (!record?.imageUrl) return null;
    const currentImagePath = getImagePathFromUrl(record.imageUrl);
    if (
      !currentImagePath ||
      !isPathInside(paths.countryCacheRoot, currentImagePath)
    ) {
      return null;
    }

    let imageBytes: Buffer;
    try {
      imageBytes = await readFile(currentImagePath);
    } catch {
      return null;
    }

    const extension = getPlaceImageExtension(record.imageUrl);
    const id = randomUUID();
    const historyImagePath = paths.historyImagePathForExtension(id, extension);
    if (!isPathInside(paths.countryCacheRoot, historyImagePath)) return null;

    const entry: PlaceImageHistoryRecord = {
      ...record,
      id,
      imageUrl: paths.historyImageUrlForExtension(id, extension),
      archivedAt: new Date().toISOString()
    };
    const manifest = await readHistoryManifest(paths);
    const entries = [...manifest.entries, entry];
    const prunedEntries = entries.slice(
      0,
      Math.max(0, entries.length - PLACE_IMAGE_HISTORY_LIMIT)
    );
    const retainedEntries = entries.slice(-PLACE_IMAGE_HISTORY_LIMIT);

    await mkdir(paths.historyRoot, { recursive: true });
    await writeFile(historyImagePath, imageBytes);
    await writeHistoryManifest(paths, {
      ...manifest,
      entries: retainedEntries
    });
    await Promise.all(
      prunedEntries.map((item) => {
        const stalePath = getImagePathFromUrl(item.imageUrl);
        return stalePath && isPathInside(paths.countryCacheRoot, stalePath)
          ? rm(stalePath, { force: true })
          : Promise.resolve();
      })
    );
    return entry;
  }

  async function readHistory(
    paths: PlaceImagePaths
  ): Promise<PlaceImageHistoryRecord[]> {
    const manifest = await readHistoryManifest(paths);
    const saved: PlaceImageHistoryRecord[] = [];
    for (const entry of manifest.entries) {
      const imagePath = getImagePathFromUrl(entry.imageUrl);
      if (!imagePath || !isPathInside(paths.countryCacheRoot, imagePath)) {
        continue;
      }
      try {
        await stat(imagePath);
        saved.push({ ...entry, active: false });
      } catch {
        // Ignore a history entry whose image was manually removed.
      }
    }
    return saved;
  }

  async function selectHistoryEntry(
    paths: PlaceImagePaths,
    entryId: string
  ): Promise<{
    previousRecord: PlaceImageRecord | null;
    record: PlaceImageRecord;
  }> {
    const manifest = await readHistoryManifest(paths);
    const target = manifest.entries.find((entry) => entry.id === entryId);
    if (!target) {
      throw new Error("That saved reference photo is no longer available.");
    }

    const targetImagePath = getImagePathFromUrl(target.imageUrl);
    if (
      !targetImagePath ||
      !isPathInside(paths.countryCacheRoot, targetImagePath)
    ) {
      throw new Error("That saved reference photo has an invalid cache path.");
    }
    const targetImage = await readFile(targetImagePath);
    const targetExtension = getPlaceImageExtension(target.imageUrl);
    const previousRecord = await readMetadata(paths);
    if (previousRecord?.imageUrl) {
      await archive(paths, previousRecord);
    }

    const refreshedManifest = await readHistoryManifest(paths);
    const nextEntries = refreshedManifest.entries.filter(
      (entry) => entry.id !== entryId
    );
    await Promise.all([
      writeFile(paths.imagePathForExtension(targetExtension), targetImage),
      rm(targetImagePath, { force: true }),
      writeHistoryManifest(paths, {
        ...refreshedManifest,
        entries: nextEntries
      })
    ]);

    const restored: PlaceImageRecord = { ...target };
    delete restored.id;
    delete restored.active;
    delete restored.archivedAt;
    delete restored.imageUrl;
    const record: PlaceImageRecord = {
      ...restored,
      imageUrl: paths.imageUrlForExtension(targetExtension),
      selectedAt: new Date().toISOString()
    };
    await writeMetadata(paths, record);
    return { record, previousRecord };
  }

  async function deleteHistoryEntry(
    paths: PlaceImagePaths,
    entryId: string
  ): Promise<void> {
    const manifest = await readHistoryManifest(paths);
    const target = manifest.entries.find((entry) => entry.id === entryId);
    if (!target) {
      throw new Error("That saved reference photo is no longer available.");
    }

    const targetImagePath = getImagePathFromUrl(target.imageUrl);
    if (
      targetImagePath &&
      !isPathInside(paths.countryCacheRoot, targetImagePath)
    ) {
      throw new Error("That saved reference photo has an invalid cache path.");
    }
    await Promise.all([
      targetImagePath
        ? rm(targetImagePath, { force: true })
        : Promise.resolve(),
      writeHistoryManifest(paths, {
        ...manifest,
        entries: manifest.entries.filter((entry) => entry.id !== entryId)
      })
    ]);
  }

  async function deleteActive(
    paths: PlaceImagePaths
  ): Promise<PlaceImageRecord> {
    const record = await readMetadata(paths);
    if (!record?.imageUrl) {
      throw new Error("The current reference photo is no longer available.");
    }
    await Promise.all([
      rm(paths.metadataPath, { force: true }),
      ...activeImagePaths(paths).map((imagePath) =>
        rm(imagePath, { force: true })
      )
    ]);
    return record;
  }

  async function writeImage(
    paths: PlaceImagePaths,
    extension: string,
    imageBuffer: Buffer
  ): Promise<void> {
    const imagePath = paths.imagePathForExtension(extension);
    if (!isPathInside(paths.countryCacheRoot, imagePath)) {
      throw new Error("Unsafe place image artifact path.");
    }
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, imageBuffer);
  }

  return {
    pathsFor,
    readCachedImage,
    readStoredRecord,
    writeMetadata,
    listStoredRecords,
    removeCountry,
    removePlace,
    readHistory,
    selectHistoryEntry,
    deleteHistoryEntry,
    deleteActive,
    writeImage
  };

  function assertSafeCountryPath(
    countryCacheRoot: string,
    countrySlug: string
  ): void {
    if (
      !isPathInside(cacheRoot, countryCacheRoot) ||
      countryCacheRoot === cacheRoot
    ) {
      throw new Error(`Unsafe place image cache path for ${countrySlug}.`);
    }
  }
}

function activeImagePaths(paths: PlaceImagePaths): string[] {
  return IMAGE_EXTENSIONS.map((extension) =>
    path.normalize(paths.imagePathForExtension(extension))
  ).filter((imagePath) => isPathInside(paths.countryCacheRoot, imagePath));
}

async function readHistoryManifest(
  paths: PlaceImagePaths
): Promise<PlaceImageHistoryManifest> {
  try {
    const parsed = JSON.parse(
      await readFile(paths.historyMetadataPath, "utf8")
    ) as unknown;
    const manifest = isRecord(parsed) ? parsed : {};
    return {
      place:
        typeof manifest.place === "string"
          ? manifest.place
          : paths.placeSlug,
      countrySlug:
        typeof manifest.countrySlug === "string"
          ? manifest.countrySlug
          : paths.countrySlug,
      entries: Array.isArray(manifest.entries)
        ? manifest.entries
            .map(toPlaceImageHistoryRecord)
            .filter((entry): entry is PlaceImageHistoryRecord =>
              Boolean(entry)
            )
        : []
    };
  } catch {
    return {
      place: paths.placeSlug,
      countrySlug: paths.countrySlug,
      entries: []
    };
  }
}

async function writeHistoryManifest(
  paths: PlaceImagePaths,
  manifest: PlaceImageHistoryManifest
): Promise<void> {
  await mkdir(path.dirname(paths.historyMetadataPath), { recursive: true });
  await writeFile(
    paths.historyMetadataPath,
    JSON.stringify(manifest, null, 2)
  );
}

function getPlaceImageExtension(imageUrl: string): string {
  const extension = path
    .extname(String(imageUrl).split("?")[0])
    .toLowerCase();
  return IMAGE_EXTENSIONS.includes(
    extension as (typeof IMAGE_EXTENSIONS)[number]
  )
    ? extension
    : ".jpg";
}

function toPlaceImageRecord(value: unknown): PlaceImageRecord | null {
  return isRecord(value) ? value : null;
}

function toPlaceImageHistoryRecord(
  value: unknown
): PlaceImageHistoryRecord | null {
  if (!isRecord(value) || !("id" in value)) return null;
  if (typeof value.imageUrl !== "string" || !value.imageUrl) return null;
  return value as PlaceImageHistoryRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
