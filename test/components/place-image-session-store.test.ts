import { describe, expect, it } from "vitest";

import {
  createPlaceImageKey,
  createPlaceImageSessionStore
} from "../../apps/web/src/features/placeImages/placeImageSessionStore";

describe("place image session store", () => {
  it("normalizes country and place identity", () => {
    expect(
      createPlaceImageKey(
        " Singapore ",
        " Marina Bay "
      )
    ).toBe("singapore:marina bay");
  });

  it("keeps country and place cache-busting state separate", () => {
    const store = createPlaceImageSessionStore();

    store.markCountryRefresh("singapore", 10);
    store.setPlaceFeedback(
      "singapore",
      "Marina Bay",
      "Show the waterfront",
      20
    );

    expect(
      store.getUrlState("singapore", "Marina Bay")
    ).toEqual({
      countryRefresh: 10,
      feedback: "Show the waterfront",
      placeRefresh: 20
    });

    store.markPlaceRefresh(
      "singapore",
      "Marina Bay",
      30
    );
    store.clearCountryRefresh("singapore");

    expect(
      store.getUrlState("singapore", "Marina Bay")
    ).toEqual({
      countryRefresh: null,
      feedback: "",
      placeRefresh: 30
    });
  });
});
