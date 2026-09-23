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
        countryPacks={{
          singapore: { registration: "source_controlled" },
          thailand: { registration: "runtime_draft" }
        }}
        onConfigure={vi.fn()}
        onOpen={vi.fn()}
      />
    );

    expect(screen.getByRole("article", { name: "Singapore, source-reviewed explorer" })).not.toBeNull();
    expect(screen.getByText("Scroll to explore every country")).not.toBeNull();
    expect(screen.getByText("live atlas packs").previousElementSibling?.textContent).toBe("2");
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

    const shelfToggle = screen.getByRole("button", { name: "Open country index" });
    expect(shelfToggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(shelfToggle);
    fireEvent.click(screen.getByRole("button", { name: "Expand country index" }));
    expect(screen.getByRole("button", { name: "Collapse country index" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Minimize country index" }));
    expect(screen.getByRole("button", { name: "Expand country index" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Minimize country index" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand country index" }));
    fireEvent.click(screen.getByRole("button", { name: "Shrink country index" }));
    expect(screen.getByRole("button", { name: "Expand country index" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close country index" }));
    expect(screen.getByRole("button", { name: "Open country index" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open country index" }));
    fireEvent.click(screen.getByRole("button", { name: "Search countries" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mal" } });
    expect(screen.queryByRole("article", { name: "Singapore, source-reviewed explorer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enter Singapore" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: "singapore" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Malaysia" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: "malaysia" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Malaysia explorer" }));
    expect(onOpen).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Configure Malaysia" }));
    expect(onConfigure).toHaveBeenCalledWith(expect.objectContaining({ code: "MY" }));
    expect(screen.getByRole("button", { name: "Configure Malaysia" }).querySelector("svg")).not.toBeNull();
  });
});
