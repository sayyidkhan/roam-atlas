import {
  worldCountries
} from "../libs/data/src/countries.ts";

const apiOrigin =
  process.env.ROAMATLAS_API_ORIGIN ??
  "http://127.0.0.1:4151";
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, value = "true"] = argument.split("=", 2);
    return [key.replace(/^--/, ""), value];
  })
);
const requestedSlugs = String(args.get("countries") ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const offset = readNonNegativeInteger(args.get("offset"), 0);
const limit = readPositiveInteger(args.get("limit"), 5);
const force = args.get("force") === "true";
const execute = args.get("execute") === "true";
const confirm = args.get("confirm") === "true";
const sourceControlledSlugs = new Set([
  "singapore",
  "malaysia"
]);
const eligibleCountries = worldCountries.filter(
  (country) => !sourceControlledSlugs.has(country.slug)
);
const selectedCountries = (
  requestedSlugs.length
    ? requestedSlugs.map((slug) => {
        const country = eligibleCountries.find(
          (candidate) => candidate.slug === slug
        );
        if (!country) {
          throw new Error(
            `Unknown or source-controlled country: ${slug}`
          );
        }
        return country;
      })
    : eligibleCountries.slice(offset, offset + limit)
);

if (!execute) {
  console.log(
    JSON.stringify(
      {
        mode: "dry_run",
        apiOrigin,
        force,
        confirm,
        countries: selectedCountries.map(
          ({ code, name, slug }) => ({
            code,
            name,
            slug
          })
        ),
        instruction:
          "Add --execute=true to run paid Exa and OpenAI research. Add --confirm=true to mark ready drafts as open for curation without verifying travel facts."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const results = [];
for (const country of selectedCountries) {
  const url = new URL("/api/country-draft", apiOrigin);
  url.searchParams.set("countrySlug", country.slug);
  if (force) url.searchParams.set("force", "true");
  const startedAt = Date.now();
  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `${response.status} ${JSON.stringify(payload)}`
      );
    }
    const draft = payload?.draft;
    const destinations = Array.isArray(draft?.regions)
      ? draft.regions.flatMap((region) =>
          Array.isArray(region?.children)
            ? region.children
            : []
        )
      : [];
    const genericChapterCount = Array.isArray(draft?.regions)
      ? draft.regions.filter((region) =>
          isGenericDirectionalChapter(region?.name)
        ).length
      : 0;
    const result = {
      countrySlug: country.slug,
      status: draft?.generationStatus ?? "unknown",
      sourceType: draft?.sourceType ?? "unknown",
      regionCount: draft?.regions?.length ?? 0,
      chapterNames: Array.isArray(draft?.regions)
        ? draft.regions.map((region) => region?.name)
        : [],
      genericChapterCount,
      destinationCount: destinations.length,
      groundedDestinationCount: destinations.filter(
        (destination) => Boolean(destination?.sourceUrl)
      ).length,
      itineraryMetadataCount: destinations.filter(
        (destination) =>
          Number.isFinite(destination?.typicalDurationMinutes) &&
          Boolean(destination?.budgetLevel) &&
          Boolean(destination?.bestTimeOfDay) &&
          Array.isArray(destination?.tags) &&
          destination.tags.length > 0
      ).length,
      sourceCount: draft?.sourceRegistry?.length ?? 0,
      durationMs: Date.now() - startedAt
    };
    if (confirm && result.status === "ready") {
      const confirmation = await confirmStarterMap(country.slug);
      Object.assign(result, confirmation);
    }
    results.push(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      countrySlug: country.slug,
      status: "failed",
      error:
        error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt
    };
    results.push(result);
    console.error(JSON.stringify(result));
  }
}

const failed = results.filter(
  (result) => result.status !== "ready"
);
console.log(
  JSON.stringify({
    completed: results.length - failed.length,
    failed: failed.length,
    total: results.length
  })
);
if (failed.length) process.exitCode = 1;

async function confirmStarterMap(countrySlug) {
  const response = await fetch(new URL("/api/country-draft/confirm", apiOrigin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countrySlug })
  });
  const payload = await response.json();
  if (!response.ok) {
    return {
      status: "failed",
      confirmation: "failed",
      error: `${response.status} ${JSON.stringify(payload)}`
    };
  }
  return { confirmation: "confirmed_for_curation" };
}

function readNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function isGenericDirectionalChapter(value) {
  const name = String(value ?? "").trim().toLowerCase();
  return /^(?:the\s+)?(?:north|northern|south|southern|east|eastern|west|western|central|northeast|north-eastern|northwest|south-east|southeast|southwest)(?:ern)?(?:\s+(?:region|area|zone))?(?:\s+.+)?$/.test(
    name
  );
}
