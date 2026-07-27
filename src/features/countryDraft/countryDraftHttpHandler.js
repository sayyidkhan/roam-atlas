import {
  createCountryPackDraftFromStarterMap,
  createCountryPackStarterMap,
  normalizeCountryDraftInstruction
} from "../../domain/countryDraft.js";
import {
  approveDraftItem,
  appendUnconfirmedRegionCandidates,
  parseDraftReviewTarget,
  unapproveDraftItem
} from "../../domain/countryDraftReview.js";

/**
 * Country-draft API policy. Storage and model calls remain injected runtime
 * adapters, while the guardrail that prevents generated content from editing
 * source-reviewed facts stays cohesive with this feature.
 */
export function createCountryDraftHttpHandlers(dependencies) {
  const {
    readJson,
    getCountryBySlug,
    getCountryPack,
    isSourceControlledCountryPack,
    countryDraftCache,
    readStoredCountryDraft,
    writeStoredCountryDraft,
    withFreshPackThemes,
    generateCountryDraft,
    normalizeCurrentCountryDraft,
    createStarterMapConfirmation,
    writeStoredCountryPromotion
  } = dependencies;

  const findCountry = (countrySlug) => getCountryBySlug(String(countrySlug ?? "").trim().toLowerCase());
  const loadCurrentDraft = async (body, country) =>
    normalizeCurrentCountryDraft(body.currentDraft, country) ??
    countryDraftCache.get(country.slug) ??
    (await readStoredCountryDraft(country)) ??
    null;
  const isSourceReviewedCountryPack = (countryPack) =>
    isSourceControlledCountryPack(countryPack) && countryPack.confidence !== "unconfirmed";

  return {
    async handleDraftRequest(url, response) {
      const countrySlug = String(url.searchParams.get("countrySlug") ?? "").trim().toLowerCase();
      const forceGenerate = url.searchParams.get("force") === "true";
      const shouldGenerate = forceGenerate || url.searchParams.get("generate") !== "false";
      const country = findCountry(countrySlug);
      if (!country) return sendUnknownCountry(response, countrySlug);

      const countryPack = getCountryPack(country.slug);
      if (isSourceControlledCountryPack(countryPack)) {
        const packSnapshot = createCountryPackStarterMap(countryPack);
        // Checked-in packs are authoritative. Runtime data can only append
        // unconfirmed candidates; it cannot replace curated source data.
        if (!forceGenerate) {
          const storedPackSnapshot = await readStoredCountryDraft(country);
          if (storedPackSnapshot?.mode === "curated_pack_snapshot") {
            for (const region of packSnapshot.regions ?? []) {
              appendUnconfirmedRegionCandidates(packSnapshot, region.name, storedPackSnapshot);
            }
            packSnapshot.changeNote = "";
          }
        }
        countryDraftCache.set(country.slug, packSnapshot);
        await writeStoredCountryDraft(country, packSnapshot);
        return sendJson(response, 200, {
          draft: packSnapshot,
          cached: false,
          persisted: true,
          regenerated: forceGenerate,
          source: "country_pack"
        });
      }

      if (!forceGenerate) {
        const cachedDraft = countryDraftCache.get(country.slug);
        if (cachedDraft) {
          const draft = withFreshPackThemes(cachedDraft, country);
          countryDraftCache.set(country.slug, draft);
          return sendJson(response, 200, { draft, cached: true });
        }
        const storedDraft = await readStoredCountryDraft(country);
        if (storedDraft) {
          const draft = withFreshPackThemes(storedDraft, country);
          countryDraftCache.set(country.slug, draft);
          return sendJson(response, 200, { draft, cached: true, persisted: true });
        }
      }

      if (!shouldGenerate) {
        return sendJson(response, 200, { draft: null, cached: false, persisted: false });
      }

      const draft = await generateCountryDraft(country);
      if (draft.generationStatus === "ready") {
        countryDraftCache.set(country.slug, draft);
        await writeStoredCountryDraft(country, draft);
      }
      return sendJson(response, 200, { draft, cached: false, regenerated: forceGenerate });
    },

    async handleInfluenceRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      if (!country) return sendUnknownCountry(response, body.countrySlug);
      const countryPack = getCountryPack(country.slug);
      const target = String(body.target ?? "starter-map").trim();

      if (isSourceReviewedCountryPack(countryPack)) {
        const parsedTarget = parseDraftReviewTarget(target);
        if (parsedTarget?.kind !== "region") {
          return sendJson(response, 409, {
            error: `${country.name} only supports append-only GenAI candidates within a selected region. Source-reviewed facts cannot be edited here.`
          });
        }
        const currentDraft =
          (await loadCurrentDraft(body, country)) ?? createCountryPackStarterMap(countryPack);
        const proposedDraft = await generateCountryDraft(country, {
          instruction: normalizeCountryDraftInstruction(body.instruction),
          currentDraft,
          appendOnlyRegionName: parsedTarget.name
        });
        const appended = appendUnconfirmedRegionCandidates(currentDraft, parsedTarget.name, proposedDraft);
        if (!appended.changed) return sendJson(response, 422, { error: appended.error });

        countryDraftCache.set(country.slug, currentDraft);
        await writeStoredCountryDraft(country, currentDraft);
        return sendJson(response, 200, {
          draft: currentDraft,
          message: {
            role: "assistant",
            text: `${appended.additions.length} unconfirmed candidate${appended.additions.length === 1 ? "" : "s"} added to ${parsedTarget.name}.`
          }
        });
      }

      const instruction = normalizeCountryDraftInstruction(body.instruction);
      if (!instruction) return sendJson(response, 400, { error: "Starter map instruction is required." });
      const currentDraft = await loadCurrentDraft(body, country);
      const draft = await generateCountryDraft(country, { instruction, currentDraft });
      if (draft.generationStatus === "ready") {
        countryDraftCache.set(country.slug, draft);
        await writeStoredCountryDraft(country, draft);
      }
      return sendJson(response, 200, {
        draft,
        message: {
          role: "assistant",
          text: draft.changeNote || "Starter map updated. All candidates remain unconfirmed."
        }
      });
    },

    async handleApprovalRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      if (!country) return sendUnknownCountry(response, body.countrySlug);
      const target = String(body.target ?? "").trim();
      const approved = body.approved !== false;
      const recursive = body.recursive === true;
      const sourceUrl = String(body.sourceUrl ?? "").trim() || null;
      const currentDraft = await loadCurrentDraft(body, country);
      if (!currentDraft) return sendJson(response, 400, { error: "Build a starter map before approving items." });

      const result = approved
        ? approveDraftItem(currentDraft, target, { sourceUrl, recursive })
        : unapproveDraftItem(currentDraft, target, { recursive });
      if (!result.changed) return sendJson(response, 400, { error: result.error ?? "Approval update failed." });

      countryDraftCache.set(country.slug, result.draft);
      await writeStoredCountryDraft(country, result.draft);
      return sendJson(response, 200, {
        draft: result.draft,
        target,
        approved,
        confidence: result.confidence,
        message: {
          role: "assistant",
          text: approved
            ? result.confidence === "confirmed"
              ? `${target.split(":")[1] ?? "Item"} marked as curated in the starter map. Update the country pack source file to make it permanent.`
              : `${target.split(":")[1] ?? "Item"} approved for map preview. Add a source URL to mark it as curated.`
            : `${target.split(":")[1] ?? "Item"} returned to needs-review status.`
        }
      });
    },

    async handleReorderRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      if (!country) return sendUnknownCountry(response, body.countrySlug);
      const draft = normalizeCurrentCountryDraft(body.currentDraft, country);
      if (!draft) return sendJson(response, 400, { error: "Build a starter map before sorting records." });

      countryDraftCache.set(country.slug, draft);
      await writeStoredCountryDraft(country, draft);
      return sendJson(response, 200, {
        draft,
        message: {
          role: "assistant",
          text: "Starter map order saved. Records still need source review before promotion."
        }
      });
    },

    async handleConfirmRequest(request, response) {
      const body = await readJson(request);
      const country = findCountry(body.countrySlug);
      if (!country) return sendUnknownCountry(response, body.countrySlug);
      if (isSourceControlledCountryPack(getCountryPack(country.slug))) {
        return sendJson(response, 409, {
          error: `${country.name} is already registered as a country pack. Confirm-for-curation only creates draft artifacts for countries that are not registered yet. For ${country.name}, move reviewed changes into the source-controlled country pack instead.`
        });
      }

      const currentDraft = await loadCurrentDraft(body, country);
      if (!currentDraft) return sendJson(response, 400, { error: "Build a starter map before confirming it for curation." });
      const confirmation = createStarterMapConfirmation(country, currentDraft);
      const countryPackDraft = createCountryPackDraftFromStarterMap(currentDraft);
      const paths = await writeStoredCountryPromotion({ country, confirmation, countryPackDraft });
      return sendJson(response, 200, {
        confirmation,
        countryPackDraft,
        paths: {
          confirmationUrl: paths.starterMapConfirmationUrl,
          countryPackDraftUrl: paths.countryPackDraftUrl
        }
      });
    }
  };
}

function sendUnknownCountry(response, countrySlug) {
  return sendJson(response, 404, { error: `Unknown country: ${countrySlug}` });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
