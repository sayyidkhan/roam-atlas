import { describe, expect, it, vi } from "vitest";

import {
  createCountryDraftStore
} from "../../apps/web/src/features/countryDraft/countryDraftStore";

describe("country draft store", () => {
  it("publishes only the changed country snapshot", () => {
    const store = createCountryDraftStore();
    const singaporeListener = vi.fn();
    const malaysiaListener = vi.fn();
    store.subscribe("singapore", singaporeListener);
    store.subscribe("malaysia", malaysiaListener);

    store.set("singapore", {
      status: "ready",
      draft: {
        summary: "Unconfirmed Singapore starter map"
      }
    });

    expect(singaporeListener).toHaveBeenCalledOnce();
    expect(malaysiaListener).not.toHaveBeenCalled();
    expect(store.get("singapore")?.draft?.summary).toBe(
      "Unconfirmed Singapore starter map"
    );
  });

  it("deletes workflow and stored-draft check state together", () => {
    const store = createCountryDraftStore();
    store.set("singapore", { status: "loading" });
    store.markStoredDraftChecked("singapore");

    store.delete("singapore");

    expect(store.has("singapore")).toBe(false);
    expect(store.hasCheckedStoredDraft("singapore")).toBe(false);
  });
});
