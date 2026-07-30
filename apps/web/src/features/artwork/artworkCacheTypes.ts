export type ArtworkCachePage = {
  artworkDecoded?: boolean;
  environmentStatus?: string;
  environmentUrl?: string | null;
  generated?: {
    environmentStatus?: string;
    environmentUrl?: string | null;
    [key: string]: unknown;
  };
  id?: string;
  imageUrl?: string | null;
  nodeId?: string | null;
  sceneId?: string | null;
  status?: string;
  [key: string]: unknown;
};

/**
 * Shared browser cache contract for generated artwork.
 *
 * Artwork owns writes while explorer readers add environment metadata to the
 * same records. Keeping one shape prevents feature intersections from turning
 * the cache maps into incompatible overloaded types.
 */
export type ArtworkCacheEntry = {
  decoded?: boolean;
  decodedPartialImageUrl?: string | null;
  environmentUrl?: string | null;
  imageUrl?: string | null;
  page?: ArtworkCachePage;
  [key: string]: unknown;
};
