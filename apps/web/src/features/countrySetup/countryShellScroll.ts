export type CountryShellScrollSnapshot = {
  windowTop: number;
  windowLeft: number;
  shellTop: number;
  shellLeft: number;
  panelTop: number;
  panelLeft: number;
};

/**
 * Preserves scroll position across the compatibility shell's full renders.
 *
 * This adapter can be deleted once country setup is fully React-owned and
 * updates no longer replace the feature subtree.
 */
export function createCountryShellScrollController(
  countryShell: HTMLElement
) {
  function capture(): CountryShellScrollSnapshot {
    const panel =
      countryShell.querySelector<HTMLElement>(
        ".country-shell-panel"
      );
    return {
      windowTop: window.scrollY,
      windowLeft: window.scrollX,
      shellTop: countryShell.scrollTop,
      shellLeft: countryShell.scrollLeft,
      panelTop: panel?.scrollTop ?? 0,
      panelLeft: panel?.scrollLeft ?? 0
    };
  }

  function restore(
    snapshot: CountryShellScrollSnapshot
  ): void {
    window.requestAnimationFrame(() => {
      window.scrollTo(snapshot.windowLeft, snapshot.windowTop);
      countryShell.scrollTop = snapshot.shellTop;
      countryShell.scrollLeft = snapshot.shellLeft;
      const panel =
        countryShell.querySelector<HTMLElement>(
          ".country-shell-panel"
        );
      if (panel) {
        panel.scrollTop = snapshot.panelTop;
        panel.scrollLeft = snapshot.panelLeft;
      }
    });
  }

  return { capture, restore };
}
