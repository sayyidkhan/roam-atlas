export type CountryRouteSummary = {
  slug: string;
};

export type CountryRoutePack = {
  nodes?: Readonly<Record<string, unknown>>;
  registration?: unknown;
  rootNodeId: string;
};

export type AppRoute<
  Country extends CountryRouteSummary = CountryRouteSummary,
  Pack extends CountryRoutePack = CountryRoutePack
> =
  | { type: "country_landing" }
  | {
      type: "country_overview";
      country: Country;
      countrySlug: string;
      pack: Pack;
    }
  | {
      type: "curated_place";
      countrySlug: string;
      nodeId: string;
      pack: Pack;
    }
  | {
      type: "invalid_place";
      countrySlug: string;
      nodeId: string;
      pack: Pack;
    }
  | {
      type: "country_unmapped_place";
      countrySlug: string;
      nodeId: string;
    }
  | {
      type: "country_config";
      country: Country;
      countrySlug: string;
      pack: Pack | null;
    }
  | {
      type: "country_needs_config";
      country: Country;
      countrySlug: string;
    }
  | { type: "unknown_country"; slug: string };

type SceneRouteRecord = {
  id: string;
  rootNodeId: string;
};

function canOpenCountryOverview(
  pack: CountryRoutePack | null | undefined
): boolean {
  return (
    pack?.registration === "source_controlled" ||
    pack?.registration === "runtime_draft"
  );
}

export function routeForCountryLanding(): string {
  return "/";
}

export function routeForCountry(
  country: CountryRouteSummary
): string {
  return `/${country.slug}`;
}

export function routeForCountryConfig(
  country: CountryRouteSummary
): string {
  return `/${country.slug}/config`;
}

export function routeForPlace(
  countrySlug: string,
  nodeId: string
): string {
  return `/${countrySlug}/place/${encodeURIComponent(nodeId)}`;
}

export function routeForNode(
  countrySlug: string,
  nodeId: string
): string {
  if (!countrySlug) {
    throw new Error("routeForNode requires an explicit country slug.");
  }
  return routeForPlace(countrySlug, nodeId);
}

export function canonicalRouteForNode(
  countrySlug: unknown,
  nodeId: string | null | undefined,
  pack?: CountryRoutePack | null
): string {
  if (!pack && typeof countrySlug !== "string") {
    return routeForCountryLanding();
  }

  if (!pack) {
    return countrySlug
      ? `/${String(countrySlug)}`
      : routeForCountryLanding();
  }

  if (
    !nodeId ||
    nodeId === pack.rootNodeId ||
    !pack.nodes?.[nodeId]
  ) {
    return `/${String(countrySlug)}`;
  }

  return routeForPlace(String(countrySlug), nodeId);
}

export function resolveAppRoute<
  Country extends CountryRouteSummary = CountryRouteSummary,
  Pack extends CountryRoutePack = CountryRoutePack
>(
  pathname: string,
  options: {
    countries?: readonly Country[];
    countryPacks?: Readonly<Record<string, Pack>>;
  } = {}
): AppRoute<Country, Pack> {
  const countries = options.countries ?? [];
  const countryPacks = options.countryPacks ?? {};
  const path = normalizePathname(pathname);
  if (path === "/") {
    return { type: "country_landing" };
  }

  const placeMatch = path.match(/^\/([a-z0-9-]+)\/place\/([^/]+)$/);
  if (placeMatch) {
    const countrySlug = placeMatch[1];
    const nodeId = decodeURIComponent(placeMatch[2]);
    const pack = countryPacks[countrySlug] ?? null;
    if (!pack?.nodes) {
      return { type: "country_unmapped_place", countrySlug, nodeId };
    }
    if (pack.nodes[nodeId]) {
      return { type: "curated_place", countrySlug, nodeId, pack };
    }

    return { type: "invalid_place", countrySlug, nodeId, pack };
  }

  const configMatch = path.match(/^\/([a-z0-9-]+)\/config$/);
  if (configMatch) {
    const slug = configMatch[1];
    const country = countries.find((item) => item.slug === slug);
    if (country) {
      const pack = countryPacks[slug] ?? null;
      return { type: "country_config", country, countrySlug: slug, pack };
    }

    return { type: "unknown_country", slug };
  }

  const countryMatch = path.match(/^\/([a-z0-9-]+)$/);
  if (countryMatch) {
    const slug = countryMatch[1];
    const country = countries.find((item) => item.slug === slug);
    if (country) {
      const pack = countryPacks[slug] ?? null;
      return pack && canOpenCountryOverview(pack)
        ? { type: "country_overview", country, countrySlug: slug, pack }
        : { type: "country_needs_config", country, countrySlug: slug };
    }

    return { type: "unknown_country", slug };
  }

  return { type: "country_landing" };
}

export function findSceneIdForNode({
  nodeId,
  nodes,
  scenes
}: {
  nodeId: string | null | undefined;
  nodes: Readonly<Record<string, unknown>>;
  scenes: Readonly<Record<string, unknown>>;
}): string | null {
  let currentNodeId = nodeId;
  const visited = new Set<string>();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const scene = Object.values(scenes).find(
      (item): item is SceneRouteRecord =>
        isSceneRouteRecord(item) &&
        (item.rootNodeId === currentNodeId ||
          item.id === currentNodeId)
    );
    if (scene) return scene.id;
    currentNodeId = readParentNodeId(nodes[currentNodeId]);
  }

  const firstScene = Object.values(scenes).find(
    isSceneRouteRecord
  );
  return firstScene?.id ?? null;
}

function normalizePathname(pathname: string): string {
  const value = String(pathname || "/").trim();
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "");
}

function isSceneRouteRecord(
  value: unknown
): value is SceneRouteRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.rootNodeId === "string"
  );
}

function readParentNodeId(value: unknown): string | undefined {
  return isRecord(value) &&
    typeof value.parentId === "string"
    ? value.parentId
    : undefined;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
