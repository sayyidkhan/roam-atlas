export type SceneArtworkRecord = {
  imageUrl?: string | null;
};

export const sceneArtwork: Record<
  string,
  SceneArtworkRecord
> = {};

export function getSceneArtwork(
  sceneId: string
): SceneArtworkRecord | null {
  return sceneArtwork[sceneId] ?? null;
}
