// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import {
  ApplicationStoreProvider,
  useApplicationStore
} from "../../apps/web/src/app/applicationStore";

function StoreWrapper({ children }: PropsWithChildren) {
  return <ApplicationStoreProvider>{children}</ApplicationStoreProvider>;
}

describe("application route store", () => {
  it("keeps country, explorer, and selection state in a typed React boundary", () => {
    const { result } = renderHook(() => useApplicationStore(), { wrapper: StoreWrapper });

    act(() => result.current.dispatch({ type: "show_country_setup", countrySlug: "singapore" }));
    expect(result.current.state).toEqual({
      view: "country",
      activeCountrySlug: "singapore",
      selectedNodeId: null
    });

    act(() => result.current.dispatch({
      type: "show_explorer",
      countrySlug: "singapore",
      nodeId: "gardens-by-the-bay"
    }));
    expect(result.current.state.selectedNodeId).toBe("gardens-by-the-bay");
  });
});
