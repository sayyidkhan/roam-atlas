export type PreloadedImageSize = {
  height: number;
  width: number;
};

type ExplorerImagePreloaderDependencies = {
  imageLoads: Map<string, Promise<PreloadedImageSize>>;
};

export function createExplorerImagePreloader({
  imageLoads
}: ExplorerImagePreloaderDependencies) {
  function preloadArtworkImage(
    imageUrl: string | null | undefined
  ): Promise<PreloadedImageSize> {
    if (!imageUrl) {
      return Promise.reject(
        new Error(
          "Artwork response did not include an image URL."
        )
      );
    }
    const existingLoad = imageLoads.get(imageUrl);
    if (existingLoad) return existingLoad;

    const load = new Promise<PreloadedImageSize>(
      (resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = async () => {
          try {
            if (typeof image.decode === "function") {
              await image.decode();
            }
            resolve({
              width: image.naturalWidth,
              height: image.naturalHeight
            });
          } catch (error) {
            reject(
              new Error(
                `Artwork could not be decoded: ${readErrorMessage(error)}`
              )
            );
          }
        };
        image.onerror = () =>
          reject(
            new Error(
              "Artwork could not be loaded by the browser."
            )
          );
        image.src = imageUrl;
      }
    ).catch((error: unknown) => {
      imageLoads.delete(imageUrl);
      throw error;
    });

    imageLoads.set(imageUrl, load);
    return load;
  }

  return { preloadArtworkImage };
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}
