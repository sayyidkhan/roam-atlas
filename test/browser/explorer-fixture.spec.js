import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { APP_CONFIG } from "../../apps/web/src/config/appConfig.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureArtworkPath = path.resolve(testDirectory, "../../public/art/country-card-atlas.jpg");

for (const viewportWidth of [1280, 684, 390]) {
  test(`shows resolved destination dots with hover and keyboard focus at ${viewportWidth}px`, async ({ page }) => {
    await checkDestinationMarkers(page, viewportWidth);
  });
}

async function checkDestinationMarkers(page, viewportWidth) {
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  const unexpectedRequests = [];
  const origin = new URL(test.info().project.use.baseURL).origin;
  const pack = JSON.parse(readFileSync(path.resolve(testDirectory, "../../apps/api/src/data/countryPacks/singapore.json"), "utf8"));
  const childIds = pack.nodes.singapore.childIds;
  const environmentUrl = "/runtime-cache/singapore/environment/fixture-overview.json";
  let releasePlan;
  const planReady = new Promise((resolve) => { releasePlan = resolve; });
  let planRequested;
  const planRequest = new Promise((resolve) => { planRequested = resolve; });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "flagcdn.com") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }
    if (url.origin !== origin) {
      unexpectedRequests.push(url.href);
      await route.abort();
      return;
    }
    if (url.pathname === "/api/artwork") {
      await route.fulfill({ json: { page: {
        id: "artwork-singapore-overview",
        countrySlug: "singapore", sceneId: "singapore-overview", nodeId: "singapore",
        imageUrl: "/public/art/country-card-atlas.jpg", environmentUrl, status: "ready",
        plan: { title: "Singapore", factMode: "curated" }
      } } });
      return;
    }
    if (url.pathname === environmentUrl) {
      planRequested();
      await planReady;
      await route.fulfill({ json: {
        version: APP_CONFIG.environmentPlan.schemaVersion,
        promptVersion: APP_CONFIG.environmentPlan.promptVersion,
        nodeId: "singapore", status: "ready", layers: [],
        targets: [...childIds, "unknown-destination"].map((nodeId, index) => ({
          nodeId,
          visualBounds: { x: 0.05 + (index % 3) * 0.3, y: 0.2 + Math.floor(index / 3) * 0.3, width: 0.2, height: 0.2 },
          labelBounds: { x: 0.05, y: 0.1, width: 0.1, height: 0.04 }
        }))
      } });
      return;
    }
    if (url.pathname === "/public/art/country-card-atlas.jpg") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
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

  try {
    await page.goto("/singapore");
    await expect(page.locator(".scene-image:not(.scene-image--backdrop)")).toBeVisible();
    await planRequest;
    await expect(page.locator(".scene-target-ripple")).toHaveCount(0);
    releasePlan();
    const markers = page.locator(".scene-target-ripple");
    await expect(markers).toHaveCount(childIds.length);
    for (const marker of await markers.all()) {
      await expect(marker).toHaveCSS("opacity", "1");
      await expect(marker.locator(".scene-target-ripple-dot")).toBeInViewport();
      await expect(marker.locator(".scene-target-ripple-ring")).toHaveCSS("opacity", "0");
      await expect(marker.locator(".scene-target-ripple-ring")).toHaveCSS("animation-name", "none");
    }
    await page.screenshot({ path: test.info().outputPath("visible-map-targets.png") });
    const target = page.getByRole("button", { name: `Explore the ${pack.nodes[childIds[0]].title} area`, exact: true });
    await expect(target).toBeVisible();
    await target.hover();
    await expect(markers.first()).toHaveClass(/is-highlighted/);
    await expect(markers.first().locator(".scene-target-ripple-ring")).toHaveCSS("animation-name", "scene-target-ripple");
    await target.click({ trial: true });
    await page.screenshot({ path: test.info().outputPath("hover-map-target.png") });
    await page.mouse.move(0, 0);
    await expect(markers.first()).not.toHaveClass(/is-highlighted/);
    await target.focus();
    await expect(markers.first()).toHaveClass(/is-highlighted/);
    await expect(markers.first().locator(".scene-target-ripple-ring")).toHaveCSS("animation-name", "scene-target-ripple");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(markers.first().locator(".scene-target-ripple-ring")).toHaveCSS("animation-name", "none");
    await expect(markers.first().locator(".scene-target-ripple-ring")).toHaveCSS("opacity", "1");
    await target.press("Tab");
    await expect(markers.first()).not.toHaveClass(/is-highlighted/);
    await expect(markers.first()).toHaveCSS("opacity", "1");
    await expect(markers.first().locator(".scene-target-ripple-ring")).toHaveCSS("opacity", "0");
    expect(unexpectedRequests).toEqual([]);
  } finally {
    releasePlan();
  }
}

test("opens Singapore with fixture artwork and no external provider traffic", async ({ page }) => {
  const unexpectedExternalRequests = [];

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());

    // The country catalogue currently renders flag thumbnails from flagcdn.
    // Serve the shared local image fixture instead so no remote image request
    // leaves the test browser.
    if (requestUrl.hostname === "flagcdn.com") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }

    if (requestUrl.origin !== new URL(test.info().project.use.baseURL).origin) {
      unexpectedExternalRequests.push(requestUrl.href);
      await route.abort();
      return;
    }

    if (requestUrl.pathname === "/api/artwork") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: "artwork-singapore-overview",
            countrySlug: "singapore",
            sceneId: "singapore-overview",
            nodeId: "singapore",
            imageUrl: "/public/art/country-card-atlas.jpg",
            environmentUrl: null,
            status: "ready",
            plan: {
              title: "Singapore",
              factMode: "curated"
            }
          }
        })
      });
      return;
    }

    if (requestUrl.pathname === "/public/art/country-card-atlas.jpg") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }

    await route.continue();
  });

  await page.goto("/singapore");

  await expect(page.getByRole("heading", { name: "Singapore" })).toBeVisible();
  await expect(page.locator(".scene-image:not(.scene-image--backdrop)")).toHaveAttribute(
    "src",
    /country-card-atlas\.jpg/
  );
  expect(unexpectedExternalRequests).toEqual([]);
});

test("keeps curated destinations accessible when fixture artwork fails", async ({ page }) => {
  const unexpectedExternalRequests = [];

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === "flagcdn.com") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }

    if (requestUrl.origin !== new URL(test.info().project.use.baseURL).origin) {
      unexpectedExternalRequests.push(requestUrl.href);
      await route.abort();
      return;
    }

    if (requestUrl.pathname === "/api/artwork") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fixture image provider unavailable" })
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/singapore");

  await expect(page.getByRole("heading", { name: "Singapore" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry illustration" })).toBeVisible();
  await expect(page.getByLabel("Available destinations")).toBeVisible();
  expect(unexpectedExternalRequests).toEqual([]);
});

test("opens Singapore with fresh runtime elements after leaving Argentina", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.hostname === "flagcdn.com") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }

    if (requestUrl.origin !== new URL(test.info().project.use.baseURL).origin) {
      await route.abort();
      return;
    }

    if (requestUrl.pathname === "/api/artwork") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: "artwork-singapore-overview",
            countrySlug: "singapore",
            sceneId: "singapore-overview",
            nodeId: "singapore",
            imageUrl: "/public/art/country-card-atlas.jpg",
            environmentUrl: null,
            status: "ready",
            plan: {
              title: "Singapore",
              factMode: "curated"
            }
          }
        })
      });
      return;
    }

    if (requestUrl.pathname === "/public/art/country-card-atlas.jpg") {
      await route.fulfill({ path: fixtureArtworkPath, contentType: "image/jpeg" });
      return;
    }

    await route.continue();
  });

  await page.goto("/argentina/config");
  await expect(
    page.getByRole("heading", { name: "Argentina", level: 1 })
  ).toBeVisible();

  await page.getByRole("button", { name: "Back to countries" }).click();
  await page.getByRole("button", { name: "Browse all countries", exact: true }).click();
  await page.getByRole("button", { name: "Search countries", exact: true }).click();
  await page.getByLabel("Search countries").fill("singapore");
  await page.getByRole("button", { name: "Preview Singapore", exact: true }).click();
  await page.getByRole("button", { name: "Explore Singapore", exact: true }).click();

  await expect(page).toHaveURL(/\/singapore$/);
  await expect(
    page.getByRole("heading", { name: "Singapore" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Argentina", level: 1 })
  ).toHaveCount(0);
  await expect(page.locator("#country-shell")).toHaveClass(/is-hidden/);
});
