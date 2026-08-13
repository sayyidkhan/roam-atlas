import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureArtworkPath = path.resolve(testDirectory, "../../public/art/country-card-atlas.jpg");

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

    if (requestUrl.origin !== "http://127.0.0.1:4150") {
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
  await expect(page.locator(".scene-image")).toHaveAttribute(
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

    if (requestUrl.origin !== "http://127.0.0.1:4150") {
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

    if (requestUrl.origin !== "http://127.0.0.1:4150") {
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
  await page.getByLabel("Search countries").fill("singapore");
  await page.getByRole("button", { name: "Open Singapore" }).click();

  await expect(page).toHaveURL(/\/singapore$/);
  await expect(
    page.getByRole("heading", { name: "Singapore" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Argentina", level: 1 })
  ).toHaveCount(0);
  await expect(page.locator("#country-shell")).toHaveClass(/is-hidden/);
});
