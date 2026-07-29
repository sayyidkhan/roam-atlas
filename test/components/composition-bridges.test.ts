import { describe, expect, it, vi } from "vitest";

import { createApplicationLifecycleBridge } from "../../apps/web/src/app/applicationLifecycleBridge";
import { createApplicationViewBridge } from "../../apps/web/src/app/applicationViewBridge";
import { createExplorerPageTransitionBridge } from "../../apps/web/src/features/explorer/explorerPageTransitionBridge";
import { createExplorerPublisherRegistry } from "../../apps/web/src/features/explorer/explorerPublisherRegistry";

describe("runtime composition bridges", () => {
  it("fails visibly before lifecycle composition and forwards after attachment", () => {
    const bridge = createApplicationLifecycleBridge();
    expect(() => bridge.enterCountryLanding()).toThrow(
      "Application lifecycle has not been composed yet."
    );

    const enterCountryLanding = vi.fn();
    type Lifecycle = Parameters<typeof bridge.attach>[0];
    const lifecycle: Lifecycle = {
      applyRoute: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      clearCountryGeneratedState: vi.fn(),
      dispose: vi.fn(),
      enterCuratedPlace: vi.fn(),
      enterCountryLanding,
      enterCountryShell: vi.fn(),
      enterMappedCountry: vi.fn(),
      setUnknownNodeNotice: vi.fn(),
      showBootstrapError: vi.fn()
    };
    bridge.attach(lifecycle);

    bridge.enterCountryLanding({ updateUrl: false });
    expect(enterCountryLanding).toHaveBeenCalledWith({
      updateUrl: false
    });
  });

  it("makes view and page-transition ordering explicit", () => {
    const viewBridge = createApplicationViewBridge();
    const transitionBridge =
      createExplorerPageTransitionBridge();
    expect(() => viewBridge.render()).toThrow(
      "Application view has not been composed yet."
    );
    expect(() => transitionBridge.clearPendingJob()).toThrow(
      "Explorer page transitions have not been composed yet."
    );

    const render = vi.fn();
    const enterReadyPage = vi.fn();
    viewBridge.attach({ render });
    transitionBridge.attach({
      clearPendingJob: vi.fn(),
      enterReadyPage
    });
    const page = {
      nodeId: "singapore",
      sceneId: "singapore-overview"
    };

    viewBridge.render();
    transitionBridge.enterReadyPage(page);
    expect(render).toHaveBeenCalledOnce();
    expect(enterReadyPage).toHaveBeenCalledWith(page);
  });

  it("publishes only through an attached explorer presentation", () => {
    const registry = createExplorerPublisherRegistry();
    expect(() => registry.publishChromeState()).toThrow(
      "Explorer publishers have not been composed yet."
    );

    const chromeContent = vi.fn();
    const chromeState = vi.fn();
    registry.attach({
      chromeContent,
      chromeState,
      destinations: vi.fn(),
      scene: vi.fn()
    });

    registry.publishChromeContent({
      breadcrumb: "Singapore",
      title: "Overview"
    });
    registry.publishChromeState();
    expect(chromeContent).toHaveBeenCalledWith({
      breadcrumb: "Singapore",
      title: "Overview"
    });
    expect(chromeState).toHaveBeenCalledOnce();
  });
});
