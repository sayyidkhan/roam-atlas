import { CountrySetupSurface } from "../features/countrySetup/CountrySetupSurface";
import { ExplorerViewport } from "../features/explorer/ExplorerViewport";
import { DraftPhotoLightbox } from "../features/placeImages/DraftPhotoLightbox";
import { AppToast } from "../features/notifications/AppToast";

export function ApplicationShell() {
  return (
    <main className="immersive-shell">
      <p
        id="runtime-notice"
        className="react-bootstrap-error"
        role="alert"
        hidden
      />

      <section
        className="country-shell is-hidden"
        id="country-shell"
        aria-label="Country overview"
      >
        <CountrySetupSurface />
      </section>

      <AppToast />
      <DraftPhotoLightbox />
      <ExplorerViewport />
    </main>
  );
}
