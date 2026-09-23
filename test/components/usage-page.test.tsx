// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UsagePage } from "../../apps/web/src/features/usage/UsagePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UsagePage", () => {
  it("renders provider totals and recent requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            generatedAt: "2026-09-22T03:00:00.000Z",
            pricingNote: "Estimated provider cost.",
            summary: {
              requests: 1,
              inputTokens: 1200,
              cachedInputTokens: 200,
              outputTokens: 300,
              imageInputTokens: 0,
              imageOutputTokens: 0,
              estimatedCostUsd: 0.01
            },
            records: [
              {
                id: "usage-1",
                timestamp: "2026-09-22T03:00:00.000Z",
                feature: "environment_plan",
                model: "gpt-5.6-terra",
                serviceTier: "fast",
                inputTokens: 1200,
                cachedInputTokens: 200,
                outputTokens: 300,
                imageInputTokens: 0,
                imageOutputTokens: 0,
                estimatedCostUsd: 0.01,
                durationMs: 1500
              }
            ]
          })
        )
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <UsagePage />
        </QueryClientProvider>
      </BrowserRouter>
    );

    expect(
      await screen.findByText("Environment plan")
    ).not.toBeNull();
    expect(screen.getByText("gpt-5.6-terra · fast")).not.toBeNull();
    expect(screen.getByText("Estimated provider cost.")).not.toBeNull();
  });
});
