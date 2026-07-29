import { describe, expect, it, vi } from "vitest";

import { applyApplicationRoute } from "../../apps/web/src/app/applicationRouteController";
import type {
  AppRoute,
  CountrySummary
} from "../../apps/web/src/app/applicationRuntimeTypes";
import type { RuntimePack } from "../../apps/web/src/app/browserRuntime";

const country: CountrySummary = {
  code: "SG",
  name: "Singapore",
  slug: "singapore"
};

const pack: RuntimePack = {
  countrySlug: "singapore",
  nodes: {
    singapore: {
      childIds: [],
      id: "singapore",
      title: "Singapore"
    }
  },
  overviewSceneId: "singapore-overview",
  rootNodeId: "singapore",
  scenes: {
    "singapore-overview": {
      coordinateSpace: { height: 100, width: 100 },
      id: "singapore-overview",
      rootNodeId: "singapore",
      tiles: [],
      title: "Singapore"
    }
  },
  title: "Singapore"
};

describe("application route controller", () => {
  it("does not activate an asynchronously resolved stale route", async () => {
    let isCurrent = true;
    let resolvePack!: (value: RuntimePack | null) => void;
    const ensureCountryPack = vi.fn(
      () =>
        new Promise<RuntimePack | null>((resolve) => {
          resolvePack = resolve;
        })
    );
    const route: AppRoute = {
      type: "country_overview",
      countrySlug: "singapore",
      country,
      pack
    };
    const enterMappedCountry = vi.fn();

    const routeRequest = applyApplicationRoute(
      "/singapore",
      { shouldRender: true },
      {
        countries: [country],
        countryPacks: {},
        ensureCountryPack,
        enterCountryLanding: vi.fn(),
        enterCountryShell: vi.fn(),
        enterCuratedPlace: vi.fn(),
        enterMappedCountry,
        isRouteCurrent: () => isCurrent,
        render: vi.fn(),
        resolveRoute: () => route,
        setUnknownNodeNotice: vi.fn()
      }
    );

    isCurrent = false;
    resolvePack(pack);
    await routeRequest;

    expect(ensureCountryPack).toHaveBeenCalledWith(
      "singapore"
    );
    expect(enterMappedCountry).not.toHaveBeenCalled();
  });
});
