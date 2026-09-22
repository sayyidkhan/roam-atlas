// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryCatalogView } from "../../apps/web/src/features/countryCatalog/CountryCatalogView";

describe("CountryCatalogView", () => {
  afterEach(cleanup);

  it("renders every country in the scrollable atlas shelf", () => {
    render(
      <CountryCatalogView
        countries={[
          { code: "AF", displayCode: "AF", name: "Afghanistan", slug: "afghanistan" },
          { code: "AL", displayCode: "AL", name: "Albania", slug: "albania" },
          { code: "DZ", displayCode: "DZ", name: "Algeria", slug: "algeria" },
          { code: "SG", displayCode: "SG", name: "Singapore", slug: "singapore" }
        ]}
        countryPacks={{}}
        onConfigure={vi.fn()}
        onOpen={vi.fn()}
      />
    );

    expect(screen.getByRole("article", { name: "Singapore, source-reviewed explorer" })).not.toBeNull();
    expect(screen.getByText("Scroll to explore every country")).not.toBeNull();
  });

  it("filters countries and emits typed open/configure intents", () => {
    const onConfigure = vi.fn();
    const onOpen = vi.fn();
    render(
      <CountryCatalogView
        countries={[
          { code: "SG", displayCode: "SG", name: "Singapore", slug: "singapore" },
          { code: "MY", displayCode: "MY", name: "Malaysia", slug: "malaysia" }
        ]}
        countryPacks={{ singapore: { confidence: "confirmed" } }}
        onConfigure={onConfigure}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand country index" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mal" } });
    expect(screen.queryByRole("article", { name: "Singapore, source-reviewed explorer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Malaysia" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: "malaysia" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Malaysia explorer" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Configure Malaysia" }));
    expect(onConfigure).toHaveBeenCalledWith(expect.objectContaining({ code: "MY" }));
    expect(screen.getByRole("button", { name: "Configure Malaysia" }).querySelector("svg")).not.toBeNull();
  });
});
