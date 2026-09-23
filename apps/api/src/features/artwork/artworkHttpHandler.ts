import {
  ArtworkRequestQuerySchema,
  ArtworkResponseSchema
} from "@roamatlas/contracts/artworkContract.js";
import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import type {
  CompiledCountryPack
} from "../../data/countryPacks/serverRegistry.ts";
import type {
  DefaultArtworkPage
} from "../../data/defaultArtworkPages.ts";

type ArtworkHttpDependencies = {
  createImageJob: (
    page: DefaultArtworkPage,
    options: {
      imageQuality: string;
      jobKind: string;
    }
  ) => Promise<unknown>;
  defaultCountrySlug: string;
  getCountryPack: (
    countrySlug: string
  ) => CompiledCountryPack | null;
  resolveConfirmedExplorerPack?: (
    countrySlug: string
  ) => Promise<CompiledCountryPack | null>;
  getDefaultArtworkPageForNode: (
    nodeId: string,
    sceneId: string | null | undefined,
    pack: CompiledCountryPack
  ) => DefaultArtworkPage | null;
  getDefaultArtworkPageForScene: (
    sceneId: string,
    pack: CompiledCountryPack
  ) => DefaultArtworkPage | null;
  normalizeImageQuality: (
    quality: unknown
  ) => string;
};

export function createArtworkRoutes(
  dependencies: ArtworkHttpDependencies
): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      "GET",
      "/api/artwork",
      (context) =>
        handleArtworkHttpRequest({
          ...dependencies,
          url: new URL(context.req.url)
        })
    );
  };
}

export async function handleArtworkHttpRequest({
  url,
  defaultCountrySlug,
  getCountryPack,
  resolveConfirmedExplorerPack,
  getDefaultArtworkPageForNode,
  getDefaultArtworkPageForScene,
  createImageJob,
  normalizeImageQuality
}: ArtworkHttpDependencies & {
  url: URL;
}): Promise<Response> {
  const query = ArtworkRequestQuerySchema.parse({
    countrySlug:
      url.searchParams.get("countrySlug") ??
      undefined,
    sceneId:
      url.searchParams.get("sceneId") ??
      undefined,
    nodeId:
      url.searchParams.get("nodeId") ??
      undefined,
    quality:
      url.searchParams.get("quality") ??
      undefined,
    priority:
      url.searchParams.get("priority") ??
      undefined,
    prefetch:
      url.searchParams.get("prefetch") ??
      undefined
  });
  const {
    sceneId,
    nodeId
  } = query;
  const countrySlug =
    query.countrySlug ?? defaultCountrySlug;
  const registeredPack = getCountryPack(countrySlug);
  const pack = await resolveArtworkCountryPack(
    registeredPack,
    resolveConfirmedExplorerPack
  );
  if (!pack) {
    return jsonResponse(
      {
        error:
          `Unknown country pack: ${countrySlug}`
      },
      404
    );
  }

  const page = nodeId
    ? getDefaultArtworkPageForNode(
        nodeId,
        sceneId,
        pack
      )
    : sceneId
      ? getDefaultArtworkPageForScene(
          sceneId,
          pack
        )
      : null;
  if (!page) {
    return jsonResponse(
      {
        error: nodeId
          ? `Unknown artwork node: ${nodeId}`
          : `Unknown artwork scene: ${sceneId}`
      },
      404
    );
  }

  const isPrefetch =
    query.prefetch === "true" ||
    query.prefetch === "priority";
  const isInteractivePriority =
    query.priority === "interactive";
  const jobKind = isInteractivePriority
    ? "interactive"
    : isPrefetch
      ? query.prefetch === "priority"
        ? "prefetch"
        : "artwork"
      : nodeId
        ? "interactive"
        : "artwork";
  const artworkPage = await createImageJob(
    page,
    {
      jobKind,
      imageQuality:
        normalizeImageQuality(query.quality)
    }
  );
  return jsonResponse(
    ArtworkResponseSchema.parse({
      page: artworkPage
    })
  );
}

async function resolveArtworkCountryPack(
  registeredPack: CompiledCountryPack | null,
  resolveConfirmedExplorerPack: ArtworkHttpDependencies["resolveConfirmedExplorerPack"]
): Promise<CompiledCountryPack | null> {
  if (
    !registeredPack ||
    registeredPack.registration === "source_controlled" ||
    !resolveConfirmedExplorerPack
  ) {
    return registeredPack;
  }
  return await resolveConfirmedExplorerPack(registeredPack.countrySlug) ?? registeredPack;
}
