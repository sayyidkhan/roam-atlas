import type { ApplicationElements } from "./applicationElements";
import type {
  ApplicationState,
  RouteNotice
} from "./applicationRuntimeTypes";

type ApplicationViewDependencies = {
  elements: ApplicationElements;
  renderCountryShell: () => void;
  renderDetour: (notice: RouteNotice) => void;
  renderExplorerChrome: () => void;
  renderNodeDetail: () => void;
  renderScene: () => void;
  state: ApplicationState;
};

export function createApplicationViewController(
  dependencies: ApplicationViewDependencies
) {
  const {
    elements,
    renderCountryShell,
    renderDetour,
    renderExplorerChrome,
    renderNodeDetail,
    renderScene,
    state
  } = dependencies;

  function render(): void {
    const focusKey = captureExplorerFocusKey();
    const isCountryShell = state.currentView === "country";
    elements.countryShell.classList.toggle(
      "is-hidden",
      !isCountryShell
    );
    renderExplorerChrome();

    if (state.currentView === "countries") return;
    if (isCountryShell) {
      renderCountryShell();
      return;
    }
    if (!state.activePack) {
      elements.runtimeNotice.hidden = false;
      elements.runtimeNotice.textContent = "Loading country…";
      return;
    }
    elements.runtimeNotice.hidden = true;

    renderScene();
    renderNodeDetail();
    if (state.routeNotice) renderDetour(state.routeNotice);
    restoreExplorerFocus(focusKey);
  }

  function captureExplorerFocusKey(): string | null {
    const activeElement = document.activeElement;
    if (
      !(activeElement instanceof HTMLElement) ||
      !elements.viewport.contains(activeElement)
    ) {
      return null;
    }
    return activeElement.dataset.roamFocusKey ?? null;
  }

  function restoreExplorerFocus(focusKey: string | null): void {
    if (!focusKey) return;
    const target = [
      ...elements.viewport.querySelectorAll<HTMLElement>(
        "[data-roam-focus-key]"
      )
    ].find(
      (element) => element.dataset.roamFocusKey === focusKey
    );
    target?.focus({ preventScroll: true });
  }

  return { render };
}
