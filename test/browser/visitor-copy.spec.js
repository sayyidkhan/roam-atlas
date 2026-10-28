import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const artworkPath = fileURLToPath(new URL("../../public/art/country-card-atlas.jpg", import.meta.url));
const pack = JSON.parse(readFileSync(new URL("../../apps/api/src/data/countryPacks/singapore.json", import.meta.url), "utf8"));
const fact = pack.nodes["merlion-park"].facts[0];

for (const providerStatus of [200, 503]) {
  test(`Merlion Park shows visitor copy when enrichment returns ${providerStatus}`, async ({ page }) => {
    const unexpectedRequests = [];
    const origin = new URL(test.info().project.use.baseURL).origin;
    let enrichmentRequests = 0;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "flagcdn.com") {
        await route.fulfill({ path: artworkPath, contentType: "image/jpeg" });
        return;
      }
      if (url.origin !== origin) {
        unexpectedRequests.push(url.href);
        await route.abort();
        return;
      }
      if (url.pathname === "/api/artwork") {
        await route.fulfill({ json: { page: {
          id: "node-merlion-park", countrySlug: "singapore", sceneId: "marina-bay-scroll",
          nodeId: "merlion-park", status: "ready", environmentUrl: null,
          imageUrl: "/fixtures/merlion.jpg", plan: { title: "Merlion Park", factMode: "curated" }
        } } });
        return;
      }
      if (url.pathname === "/fixtures/merlion.jpg") {
        await route.fulfill({ path: artworkPath, contentType: "image/jpeg" });
        return;
      }
      if (url.pathname === "/api/leaf-study") {
        enrichmentRequests += 1;
        await route.fulfill({ status: providerStatus, json: { notes: [{
          id: fact.id,
          text: "Merlion Park appears as a curated photo stop on the Marina Bay demo path. This is testing content."
        }] } });
        return;
      }
      if (url.pathname === "/api/country-packs" || url.pathname === "/api/experience-config") {
        await route.continue();
        return;
      }
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/runtime-cache/")) {
        unexpectedRequests.push(`${route.request().method()} ${url.pathname}`);
        await route.fulfill({ status: 503, json: { error: "Undeclared fixture request" } });
        return;
      }
      await route.continue();
    });
    await page.goto("/singapore/place/merlion-park");
    await expect(page.locator(".leaf-study-fact")).toHaveText(fact.text);
    await expect.poll(() => enrichmentRequests).toBe(1);
    await expect(page.locator(".leaf-study-fact")).toHaveText(fact.text);
    await expect(page.locator("body")).not.toContainText(/\b(?:demo|testing|prototype|hackathon|MVP|first-slice)\b/i);
    await expect(page.locator(".leaf-study-meta")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("visitor-place-copy.png") });
    expect(unexpectedRequests).toEqual([]);
  });
}
