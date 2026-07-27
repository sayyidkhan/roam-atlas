// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CountryCatalogView } from "../../src/features/countryCatalog/CountryCatalogView";

describe("CountryCatalogView", () => {
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

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mal" } });
    expect(screen.queryByText("Singapore")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: "malaysia" }));
    fireEvent.click(screen.getByRole("button", { name: "Configure Malaysia" }));
    expect(onConfigure).toHaveBeenCalledWith(expect.objectContaining({ code: "MY" }));
    expect(screen.getByRole("button", { name: "Configure Malaysia" }).querySelector("svg")).not.toBeNull();
  });
});
