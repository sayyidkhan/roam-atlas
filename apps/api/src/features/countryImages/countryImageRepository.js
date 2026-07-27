import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export function createCountryImageRepository({
  storageDirectory,
  urlPrefix
}) {
  async function find(country) {
    for (const basename of getImageBasenames(country)) {
      for (const extension of SUPPORTED_IMAGE_EXTENSIONS) {
        const filePath = path.join(
          storageDirectory,
          `${basename}${extension}`
        );
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            return {
              filePath,
              imageUrl: `${urlPrefix}/${basename}${extension}`
            };
          }
        } catch {
          // Try the next supported extension.
        }
      }
    }
    return null;
  }

  async function write(country, imageBytes, extension) {
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(
      path.join(storageDirectory, `${country.slug}${extension}`),
      imageBytes
    );
    return `${urlPrefix}/${country.slug}${extension}`;
  }

  function isLocalImageUrl(imageUrl) {
    return String(imageUrl ?? "").startsWith(urlPrefix);
  }

  return { find, write, isLocalImageUrl };
}

function getImageBasenames(country) {
  const basenames = new Set([country.slug, country.code.toLowerCase()]);
  if (country.code === "PS") basenames.add("palestine");
  return [...basenames];
}
