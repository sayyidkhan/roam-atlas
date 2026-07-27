export function ApplicationShell() {
  return (
    <main className="immersive-shell">
      <section className="country-landing" id="country-landing" aria-label="Choose a country">
        <header className="country-hero">
          <div>
            <p className="eyebrow">RoamAtlas</p>
            <h1>Choose a country</h1>
            <p>
              Explore the world through visual country guides, curated discoveries, and
              itinerary-ready places.
            </p>
          </div>
        </header>

        <section className="country-toolbar" aria-label="Country filters">
          <label className="search-field">
            <span>Search countries</span>
            <input
              id="country-search"
              type="search"
              placeholder="Search by country name or code"
              autoComplete="off"
            />
          </label>
          <p id="country-count" className="country-count" />
        </section>

        <section id="country-notice" className="country-notice" aria-live="polite" />
        <section className="country-grid" id="country-grid" aria-label="Country cards" />
      </section>

      <section
        className="country-shell is-hidden"
        id="country-shell"
        aria-label="Country overview"
      />

      <section
        className="scroll-viewport is-hidden"
        id="scroll-viewport"
        aria-label="RoamAtlas visual explorer"
      >
        <header className="scene-hud">
          <div>
            <p className="eyebrow">RoamAtlas</p>
            <h1 id="scene-title">Country Overview Scroll</h1>
            <p id="breadcrumb">Curated facts. Generated-style visuals.</p>
          </div>
        </header>

        <div className="corner-actions">
          <button id="country-button" type="button" className="ghost-button">
            Countries
          </button>
          <button id="back-button" type="button" className="ghost-button">
            Back
          </button>
        </div>

        <div className="scroll-stage" id="scroll-stage" />

        <aside className="detail-sheet" id="detail-sheet" aria-label="Selected detail">
          <button
            className="sheet-close"
            id="close-detail"
            type="button"
            aria-label="Close detail"
          >
            ×
          </button>
          <section id="node-detail" />
        </aside>
      </section>
    </main>
  );
}
