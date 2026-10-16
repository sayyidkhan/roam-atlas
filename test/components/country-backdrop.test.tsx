// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CountryBackdrop } from "../../apps/web/src/features/landingVariants/horizon/CountryBackdrop";

const photos: { src: string; onload: null | (() => Promise<void>); decode: () => Promise<void> }[] = [];
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); photos.length = 0; });

it("keeps the existing photo until decode completes, ignores stale requests, and retires layers after the fade", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", class {
    src = "";
    onload = null;
    decode = vi.fn().mockResolvedValue(undefined);
    constructor() { photos.push(this); }
  });
  const { container, rerender } = render(<CountryBackdrop slug="norway" />);
  rerender(<CountryBackdrop slug="japan" />);
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector("img")?.src).toContain("norway");
  let decode: () => void = () => {};
  photos[1].decode = () => new Promise<void>((resolve) => { decode = resolve; });
  let loading: Promise<void>;
  await act(async () => { loading = photos[1].onload!(); });
  expect(container.querySelectorAll("img")).toHaveLength(1);
  await act(async () => { decode(); await loading; });
  expect(container.querySelectorAll("img")).toHaveLength(2);
  rerender(<CountryBackdrop slug="france" />);
  const staleLoad = photos[2].onload!;
  rerender(<CountryBackdrop slug="italy" />);
  await act(async () => { await staleLoad(); });
  expect([...container.querySelectorAll("img")].some((image) => image.src.includes("france"))).toBe(false);
  await act(async () => { await photos[3].onload!(); });
  expect(container.querySelectorAll("img")).toHaveLength(3);
  act(() => { vi.advanceTimersByTime(900); });
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector("img")?.src).toContain("italy");
});
