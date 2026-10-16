// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CountryEncyclopedia } from "../../apps/web/src/features/countryEncyclopedia/CountryEncyclopedia";
import { countryArticleTitle, retrieveCountryEncyclopedia } from "../../apps/web/src/features/countryEncyclopedia/countryEncyclopediaProvider";
import { installDialogFixture } from "../support/dialog-dom";

const norway = { name: "Norway", code: "NO", displayCode: "NO", slug: "norway" };
let restore: () => void;
beforeEach(() => { restore = installDialogFixture(); });
afterEach(() => { cleanup(); restore(); vi.unstubAllGlobals(); });

it("retrieves a plain-text overview and keeps source metadata separate from reviewed facts", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [{ title: "Norway", extract: "Fixture overview.\nSecond fixture paragraph." }] } }) });
  vi.stubGlobal("fetch", fetcher);
  const dismiss = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><CountryEncyclopedia country={norway} onDismiss={dismiss} /></QueryClientProvider>);
  expect(await screen.findByText("Fixture overview.")).toBeTruthy();
  expect(screen.getByText("Second fixture paragraph.")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Read the full article/ }).getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Norway");
  expect(screen.getByText(/General background, not reviewed travel advice/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close encyclopedia" }));
  expect(dismiss).toHaveBeenCalled();
  expect(fetcher.mock.calls[0][0]).toContain("origin=*");
});

it("rejects ambiguous or missing articles and resolves ambiguous country names", async () => {
  expect(countryArticleTitle({ ...norway, code: "GE", name: "Georgia" })).toBe("Georgia (country)");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [{ title: "Georgia", extract: "Ambiguous", pageprops: { disambiguation: "" } }] } }) }));
  await expect(retrieveCountryEncyclopedia(norway)).rejects.toThrow("No country overview");
});

it("offers retry and a direct source link when retrieval fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
  render(<QueryClientProvider client={new QueryClient()}><CountryEncyclopedia country={norway} onDismiss={vi.fn()} /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Read the full article/ })).toBeTruthy();
});
