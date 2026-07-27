/**
 * Renders and progressively hydrates the country catalogue. This feature owns
 * decorative country media only; country-pack facts remain in curated data.
 */
export function createCountryCatalog({
  elements,
  worldCountries,
  getCountryPack,
  apiPath,
  config
}) {
  const {
    imageVersion,
    imageConcurrency,
    localAssetBasePath,
    localAssetExtension,
    localAssetExtensionOverrides
  } = config;
  let photoObserver = null;
  let activePhotoLoads = 0;
  let photoQueue = [];

  function render(queryValue = "") {
    elements.countryNotice.classList.remove("is-open");
    elements.countryNotice.replaceChildren();
    const query = normalizeCountryQuery(queryValue);
    const filteredCountries = worldCountries.filter((country) => {
      if (!query) return true;
      return (
        normalizeCountryQuery(country.name).includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.displayCode.toLowerCase().includes(query)
      );
    });

    elements.countryCount.textContent = `${filteredCountries.length} of ${worldCountries.length} countries`;
    resetPhotoQueue();
    const fragment = document.createDocumentFragment();
    for (const country of filteredCountries) {
      fragment.appendChild(renderCountryCard(country));
    }
    elements.countryGrid.replaceChildren(fragment);
    observePhotos(elements.countryGrid);
  }

  function renderCountryCard(country) {
    const pack = getCountryPack(country.slug);
    const isConfirmedPack = pack?.confidence !== "unconfirmed";
    const cardState = isConfirmedPack ? "mapped" : "available";
    const card = document.createElement("article");
    card.className = `country-card country-card--${cardState}`;
    card.dataset.countryCode = country.code;
    card.setAttribute("aria-label", `${country.name}, ${isConfirmedPack ? "source-reviewed explorer" : "starter explorer"}`);
    const picturePosition = getCountryPicturePosition(country.code);
    card.style.setProperty("--country-picture-x", picturePosition.x);
    card.style.setProperty("--country-picture-y", picturePosition.y);

    const photo = document.createElement("img");
    photo.className = "country-card-photo";
    photo.dataset.src = getBundledCountryPhotoUrl(country);
    photo.dataset.fallbackSrc = getCountryPhotoFallbackUrl(country);
    photo.alt = "";
    photo.loading = "lazy";
    photo.decoding = "async";
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("error", () => {
      if (photo.dataset.fallbackSrc) {
        photo.src = photo.dataset.fallbackSrc;
        delete photo.dataset.fallbackSrc;
        return;
      }
      photo.remove();
      card.classList.add("country-card--photo-fallback");
    });

    const visual = document.createElement("span");
    visual.className = "country-card-visual";

    const flag = document.createElement("img");
    flag.className = "country-flag";
    flag.src = getCountryFlagUrl(country.code, 160);
    flag.srcset = [
      `${getCountryFlagUrl(country.code, 80)} 80w`,
      `${getCountryFlagUrl(country.code, 160)} 160w`,
      `${getCountryFlagUrl(country.code, 320)} 320w`
    ].join(", ");
    flag.sizes = "(max-width: 720px) 72px, 96px";
    flag.alt = "";
    flag.loading = "lazy";
    flag.decoding = "async";
    flag.addEventListener("error", () => {
      flag.remove();
      visual.classList.add("country-card-visual--fallback");
      visual.textContent = country.displayCode;
    });
    visual.append(flag);

    const code = document.createElement("span");
    code.className = "country-code";
    code.textContent = country.displayCode;

    const title = document.createElement("span");
    title.className = "country-name";
    title.textContent = country.name;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "country-status";
    openButton.setAttribute("data-country-card-action", "open");
    openButton.textContent = "Open";

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "country-card-menu";
    menu.setAttribute("data-country-card-action", "config");
    menu.setAttribute("aria-label", `Configure ${country.name}`);
    menu.innerHTML = `
      <svg class="country-card-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2.05 2.05 0 0 1-2.9 2.9l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .52V20a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-.52 1.7 1.7 0 0 0-1.88.34l-.06.06a2.05 2.05 0 0 1-2.9-2.9l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.52-1H4a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 .52-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2.05 2.05 0 0 1 2.9-2.9l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.52V4a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 .52 1.7 1.7 0 0 0 1.88-.34l.06-.06a2.05 2.05 0 0 1 2.9 2.9l-.06.06A1.7 1.7 0 0 0 19.4 9c.16.36.35.7.52 1H20a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-.52 1Z"></path>
      </svg>
    `;

    const footer = document.createElement("span");
    footer.className = "country-card-footer";
    footer.append(title, openButton, code);

    card.append(photo, visual, menu, footer);
    return card;
  }

  function getBundledCountryPhotoUrl(country) {
    const extension =
      localAssetExtensionOverrides[country.slug] ?? localAssetExtension;
    return `${localAssetBasePath}/${country.slug}.${extension}`;
  }

  function getCountryPhotoFallbackUrl(country) {
    return apiPath(
      `/api/country-image?countrySlug=${encodeURIComponent(country.slug)}&v=${imageVersion}`
    );
  }

  function observePhotos(container) {
    const photos = [...container.querySelectorAll(".country-card-photo[data-src]")];
    if (!("IntersectionObserver" in window)) {
      photos.forEach(queuePhoto);
      return;
    }

    photoObserver?.disconnect();
    photoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          queuePhoto(entry.target);
          photoObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "520px 0px" }
    );

    photos.forEach((photo) => photoObserver.observe(photo));
  }

  function resetPhotoQueue() {
    photoObserver?.disconnect();
    photoObserver = null;
    photoQueue = [];
    activePhotoLoads = 0;
  }

  function queuePhoto(photo) {
    if (!photo?.dataset?.src || photo.dataset.queued === "true") return;
    photo.dataset.queued = "true";
    photoQueue.push(photo);
    processPhotoQueue();
  }

  function processPhotoQueue() {
    while (activePhotoLoads < imageConcurrency && photoQueue.length > 0) {
      const photo = photoQueue.shift();
      if (!photo?.isConnected || !photo.dataset.src || photo.src) continue;
      activePhotoLoads += 1;
      const finish = () => {
        activePhotoLoads = Math.max(0, activePhotoLoads - 1);
        processPhotoQueue();
      };
      photo.addEventListener("load", finish, { once: true });
      photo.addEventListener("error", finish, { once: true });
      photo.src = photo.dataset.src;
      delete photo.dataset.src;
    }
  }

  return { render };
}

function getCountryFlagUrl(code, width) {
  return `https://flagcdn.com/w${width}/${String(code).toLowerCase()}.png`;
}

function getCountryPicturePosition(code) {
  const seed = String(code)
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);
  return {
    x: `${12 + (seed % 76)}%`,
    y: `${14 + ((seed * 5) % 70)}%`
  };
}

function normalizeCountryQuery(value) {
  return String(value).trim().toLowerCase();
}
