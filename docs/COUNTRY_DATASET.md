# Country Travel Curation Dataset

RoamAtlas prepares source-grounded travel graphs, not generic country
directories. Each draft contains:

- Four to six travel regions.
- Twelve to twenty child destinations across those regions.
- Culture, food, nature, wildlife, family, history, architecture, beach, city,
  photography, or adventure tags.
- Approximate duration, budget level, and best time of day.
- A source registry with URL, title, excerpt, and research purpose.
- Explicit confidence and review status.

Drafts are stored outside source control in the runtime cache:

```text
<runtime-cache>/<country-slug>/starter-map/country.json
```

Reviewed facts are promoted into one source-controlled file per country under
`apps/api/src/data/countryPacks/`.

## Fact Boundary

Exa results and OpenAI-structured drafts are research candidates. They do not
verify:

- Visa or entry requirements.
- Safety or health guidance.
- Opening hours, prices, or closures.
- Transport schedules.
- Attractions, rankings, or recommended routes.

Those claims belong in individual source-controlled files under
`apps/api/src/data/countryPacks/` and require official-source review.

## Required Source Order

Research each country using official sources first:

1. National tourism authority.
2. Government or cultural authority.
3. Official transport authority.
4. Official attraction operators.

Every accepted fact must retain its source URL, source type, confidence, and a
checked-at timestamp when freshness matters. Generated text can help summarize
reviewed sources, but it cannot promote a claim to confirmed status.

## Running Curation

Preview a batch without making paid requests:

```bash
npm run data:curate -- --limit=5
```

Generate a named batch:

```bash
npm run data:curate -- \
  --countries=thailand,vietnam,indonesia \
  --execute=true
```

Use `--force=true` only when existing drafts should be regenerated. The runner
is sequential and resumable; without force, stored drafts are reused.

## Recommended Batch Size

Curate travel content for one to five countries per batch. For each country:

1. Register and review official sources.
2. Add a small country overview with three to five regions.
3. Review the proposed 12 to 20 destinations against their linked sources.
4. Validate parent-child relationships, source links, and confidence labels.
5. Promote accepted records into the source-controlled country pack and run
   the quality gates.

This keeps review practical and prevents unverified bulk-generated claims from
entering the confirmed graph.
