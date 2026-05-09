export const sceneArtwork = {};

export function getSceneArtwork(sceneId) {
  return sceneArtwork[sceneId] ?? null;
}
