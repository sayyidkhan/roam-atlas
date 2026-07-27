type CountrySetupCountry = {
  code: string;
  name: string;
  slug: string;
};

type ImageQualityOption = {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
};

type CacheFlushState = {
  status: "loading" | "failed" | string;
  scope?: string;
  message?: string;
};

type CountryShellViewInput = {
  country: CountrySetupCountry;
  canOpenMap: boolean;
  draftState: unknown;
  flushState: CacheFlushState | null | undefined;
  imageQuality: string;
  imageQualityOptions: ImageQualityOption[];
  isActionLegendOpen: boolean;
  isConfiguredCountryPack: (countrySlug: string) => boolean;
  escapeHtml: (value: unknown) => string;
  renderDraftPanel: (country: CountrySetupCountry, draftState: unknown) => string;
};

type ActionButton = {
  action: string;
  label: string;
  info: string;
  disabled?: boolean;
};

/**
 * Pure rendering for the country setup shell. Event handling and draft-photo
 * hydration are coordinated by the country setup feature controllers.
 */
export function renderCountryShellView({
  country,
  canOpenMap,
  draftState,
  flushState,
  imageQuality,
  imageQualityOptions,
  isActionLegendOpen,
  isConfiguredCountryPack,
  escapeHtml,
  renderDraftPanel
}: CountryShellViewInput): string {
  const isCacheFlushing = flushState?.status === "loading";
  const mapAction = canOpenMap
    ? renderActionButton({
        action: "country-map",
        label: `Open ${country.name} map`,
        info: `Open the current ${country.name} explorer.`
      }, escapeHtml)
    : renderActionButton({
        action: "build-starter-map",
        label: `Build ${country.name} map`,
        info: isConfiguredCountryPack(country.slug)
          ? `Load the original source-controlled ${country.name} map.`
          : `Create an unconfirmed starter map for ${country.name}.`
      }, escapeHtml);

  return `
    <article class="country-shell-panel">
      <header class="country-config-hero">
        <div>
          <p class="eyebrow">${country.code} country config</p>
          <h1>${country.name}</h1>
          <p>Manage ${country.name} generated map data and starter information before opening the explorer.</p>
        </div>
        ${renderActionGuide(country, { canOpenMap, isOpen: isActionLegendOpen, isConfiguredCountryPack, escapeHtml })}
      </header>

      <section class="country-shell-actions" aria-label="Manual country actions">
        ${renderActionButton({ action: "countries", label: "Back to countries", info: "Return to the full country list." }, escapeHtml)}
        ${renderActionButton({
          action: "reset-generated-visuals",
          label: isCacheFlushing ? "Resetting visuals" : "Reset Generated Visuals",
          info: `Delete generated ${country.name} map illustrations, image jobs, ambience, and AI click-understanding cache. Starter-map builder information and reference photos stay.`,
          disabled: isCacheFlushing
        }, escapeHtml)}
        ${mapAction}
      </section>
      ${renderImageQualitySetting({ imageQuality, imageQualityOptions })}
      ${renderCacheFlushNotice(flushState, escapeHtml)}
      ${renderDraftPanel(country, draftState)}
    </article>
  `;
}

function renderImageQualitySetting({
  imageQuality,
  imageQualityOptions
}: Pick<CountryShellViewInput, "imageQuality" | "imageQualityOptions">): string {
  return `
    <section class="country-image-quality" aria-labelledby="image-quality-title">
      <div class="country-image-quality-copy">
        <p class="eyebrow">Illustration quality</p>
        <h2 id="image-quality-title">Generated image detail</h2>
        <p>Choose the quality for new and regenerated map illustrations. High is recommended for the clearest atlas artwork.</p>
      </div>
      <div class="image-quality-options" role="radiogroup" aria-label="Generated image quality">
        ${imageQualityOptions.map((option) => {
          const isActive = imageQuality === option.value;
          return `
            <button
              type="button"
              class="image-quality-option${isActive ? " is-active" : ""}"
              data-country-action="set-image-quality"
              data-image-quality="${option.value}"
              role="radio"
              aria-checked="${isActive}"
            >
              <span class="image-quality-option-title">
                ${option.label}
                ${option.recommended ? '<span class="image-quality-recommended">Recommended</span>' : ""}
              </span>
              <small>${option.description}</small>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderActionGuide(
  country: CountrySetupCountry,
  {
    canOpenMap,
    isOpen,
    isConfiguredCountryPack,
    escapeHtml
  }: {
    canOpenMap: boolean;
    isOpen: boolean;
    isConfiguredCountryPack: CountryShellViewInput["isConfiguredCountryPack"];
    escapeHtml: CountryShellViewInput["escapeHtml"];
  }
): string {
  return `
    <div class="country-action-guide">
      <button type="button" class="ghost-button country-action-guide-button" data-country-action="toggle-action-guide" aria-expanded="${isOpen}" aria-controls="country-action-legend">Action guide</button>
      ${isOpen ? renderActionLegend(country, { canOpenMap, isConfiguredCountryPack, escapeHtml }) : ""}
    </div>
  `;
}

function renderActionLegend(
  country: CountrySetupCountry,
  {
    canOpenMap,
    isConfiguredCountryPack,
    escapeHtml
  }: {
    canOpenMap: boolean;
    isConfiguredCountryPack: CountryShellViewInput["isConfiguredCountryPack"];
    escapeHtml: CountryShellViewInput["escapeHtml"];
  }
): string {
  const isSourceControlled = isConfiguredCountryPack(country.slug);
  const mapLabel = canOpenMap ? `Open ${country.name} map` : `Build ${country.name} map`;
  const mapDescription = canOpenMap
    ? `Enter the current ${country.name} explorer using the available starter or curated map data.`
    : isSourceControlled
      ? `Load the original source-controlled ${country.name} map before opening the explorer.`
      : `Create an unconfirmed starter map for ${country.name} before opening the explorer.`;
  return `
    <section class="country-action-legend" id="country-action-legend" aria-label="Country action legend">
      <p class="eyebrow">Action guide</p>
      <dl>
        <div><dt>Back to countries</dt><dd>Return to the full country picker without changing this starter map.</dd></div>
        <div><dt>Reset Generated Visuals</dt><dd>Clear cached map illustrations, image jobs, ambience, and AI click-understanding cache for ${escapeHtml(country.name)}. Starter-map builder information and reference photos stay.</dd></div>
        <div><dt>${escapeHtml(mapLabel)}</dt><dd>${escapeHtml(mapDescription)}</dd></div>
      </dl>
    </section>
  `;
}

function renderActionButton(
  { action, label, info, disabled = false }: ActionButton,
  escapeHtml: CountryShellViewInput["escapeHtml"]
): string {
  return `
    <button type="button" class="ghost-button country-action-button" data-country-action="${escapeHtml(action)}" title="${escapeHtml(info)}" aria-label="${escapeHtml(`${label}. ${info}`)}" ${disabled ? "disabled" : ""}>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function renderCacheFlushNotice(
  flushState: CacheFlushState | null | undefined,
  escapeHtml: CountryShellViewInput["escapeHtml"]
): string {
  if (!flushState || !["loading", "failed"].includes(flushState.status)) return "";
  const visualsOnly = flushState.scope === "visuals";
  const title = flushState.status === "failed"
    ? visualsOnly ? "Visual reset failed" : "Runtime reset failed"
    : visualsOnly ? "Resetting generated visuals" : "Resetting runtime artifacts";
  const message = flushState.message ?? (visualsOnly
    ? "Clearing generated images and visual cache."
    : "Clearing generated runtime artifacts.");
  const className = flushState.status === "failed"
    ? "cache-flush-notice cache-flush-notice--failed"
    : "cache-flush-notice";
  return `<section class="${className}" aria-live="polite"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></section>`;
}
