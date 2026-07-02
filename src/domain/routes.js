export function routeForCountryLanding() {
  return "/";
}

export function routeForSingaporeOverview() {
  return "/singapore";
}

export function routeForCountry(country) {
  return `/${country.slug}`;
}

export function routeForCountryConfig(country) {
  return `/${country.slug}/config`;
}

export function routeForPlace(countrySlug, nodeId) {
  return `/${countrySlug}/place/${encodeURIComponent(nodeId)}`;
}

export function routeForNode(nodeId) {
  return routeForPlace("singapore", nodeId);
}

export function canonicalRouteForNode(countrySlug, nodeId, pack) {
  if (!pack && typeof countrySlug !== "string") {
    return routeForSingaporeOverview();
  }

  if (!pack) {
    return routeForPlace("singapore", nodeId);
  }

  if (!nodeId || nodeId === pack.rootNodeId || !pack.nodes[nodeId]) {
    return `/${countrySlug}`;
  }

  return routeForPlace(countrySlug, nodeId);
}

export function resolveAppRoute(pathname, { countries = [], countryPacks = {} } = {}) {
  const path = normalizePathname(pathname);
  if (path === "/") {
    return { type: "country_landing" };
  }

  const placeMatch = path.match(/^\/([a-z0-9-]+)\/place\/([^/]+)$/);
  if (placeMatch) {
    const countrySlug = placeMatch[1];
    const nodeId = decodeURIComponent(placeMatch[2]);
    const pack = countryPacks[countrySlug] ?? null;
    if (!pack) {
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
      return pack
        ? { type: "country_overview", country, countrySlug: slug, pack }
        : { type: "country_config", country, countrySlug: slug };
    }

    return { type: "unknown_country", slug };
  }

  const countryMatch = path.match(/^\/([a-z0-9-]+)$/);
  if (countryMatch) {
    const slug = countryMatch[1];
    const country = countries.find((item) => item.slug === slug);
    if (country) {
      const pack = countryPacks[slug] ?? null;
      return pack
        ? { type: "country_overview", country, countrySlug: slug, pack }
        : { type: "country_needs_config", country, countrySlug: slug };
    }

    return { type: "unknown_country", slug };
  }

  return { type: "country_landing" };
}

export function findSceneIdForNode({ nodeId, nodes, scenes }) {
  let currentNodeId = nodeId;
  const visited = new Set();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const scene = Object.values(scenes).find(
      (item) => item.rootNodeId === currentNodeId || item.id === currentNodeId
    );
    if (scene) return scene.id;
    currentNodeId = nodes[currentNodeId]?.parentId;
  }

  return "singapore-overview";
}

function normalizePathname(pathname) {
  const value = String(pathname || "/").trim();
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "");
}
