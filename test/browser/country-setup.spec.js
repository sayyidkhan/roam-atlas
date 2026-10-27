import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createCountryPackStarterMap } from "../../libs/domain/src/countryPackDraftProjection.ts";

const artworkPath = fileURLToPath(new URL("../../public/art/country-card-atlas.jpg", import.meta.url));
const countryPack = JSON.parse(readFileSync(new URL("../../apps/api/src/data/countryPacks/singapore.json", import.meta.url), "utf8"));
const draft = createCountryPackStarterMap(countryPack, { generatedAt: "2026-10-22T00:00:00.000Z" });
const firstChapter = draft.regions[0];
const firstChild = firstChapter.children[0];

async function isolateSetupRequests(page) {
  const unexpectedRequests = [];
  const origin = new URL(test.info().project.use.baseURL).origin;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      unexpectedRequests.push(request.url());
      await route.abort();
      return;
    }

    if (url.pathname === "/api/country-draft") {
      await route.fulfill({ json: { draft, cached: true, source: "country_pack" } });
      return;
    }
    if (url.pathname === "/api/artwork/quality-lock") {
      await route.fulfill({ json: { countrySlug: "singapore", imageQuality: "high", locked: true } });
      return;
    }
    if (url.pathname === "/api/place-image" || url.pathname === "/api/country-image") {
      await route.fulfill({ path: artworkPath, contentType: "image/jpeg" });
      return;
    }
    // These endpoints read local configuration and source-controlled packs only.
    if (url.pathname === "/api/country-packs" || url.pathname === "/api/experience-config") {
      await route.continue();
      return;
    }
    // Fail closed for every other API route, including provider-backed artwork,
    // click resolution, Wikipedia, reference-photo searches, and draft writes.
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/runtime-cache/")) {
      unexpectedRequests.push(`${request.method()} ${url.pathname}`);
      await route.fulfill({ status: 503, json: { error: "No provider route is allowed in setup UI tests" } });
      return;
    }
    await route.continue();
  });

  return unexpectedRequests;
}

async function openSetup(page) {
  await page.goto("/singapore/config");
  await expect(page.getByRole("heading", { name: "Singapore", level: 1 })).toBeVisible();
  await expect(page.getByText("Curated data", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /^Candidate regions/ })).toBeVisible();
  const quality = page.getByRole("combobox", { name: "Illustration detail", exact: true });
  await expect(quality).toHaveText("High");
  await expect(quality).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Locked · reset visuals to change" })).toBeVisible();
  const review = page.getByRole("link", { name: "Where this info comes from", exact: true });
  const header = page.locator(".country-draft-header");
  const before = await header.boundingBox();
  await expect(page.getByRole("dialog", { name: "About the travel info" })).toBeHidden();
  await review.click();
  const dialog = page.getByRole("dialog", { name: "About the travel info", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/They do not update live/)).toBeVisible();
  await expect(dialog.getByText(/A picture can contain imagined details/)).toBeVisible();
  await expect(dialog.getByText(/It does not mean the details were checked recently/)).toBeVisible();
  await expect(dialog.getByText(/Check the venue’s official website for current details/)).toBeVisible();
  await expect(dialog.getByText(draft.reviewChecklist[0], { exact: true })).toBeHidden();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(Math.abs(bounds.x + bounds.width - page.viewportSize().width)).toBeLessThan(2);
  const after = await header.boundingBox();
  for (const key of ["x", "y", "width", "height"]) expect(Math.abs(after[key] - before[key])).toBeLessThan(1);
  const close = dialog.getByRole("button", { name: "Close travel information", exact: true });
  await expect(close).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
  if (page.viewportSize().width === 690) {
    await page.screenshot({ path: test.info().outputPath("config-source-review.png"), fullPage: true });
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(review).toBeFocused();
  await expect(review).toHaveAttribute("aria-expanded", "false");
  await review.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(review).toBeFocused();
}

test("keeps secondary controls readable on hover and explains curated status", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const unexpectedRequests = await isolateSetupRequests(page);
  await page.route("**/api/artwork/quality-lock**", (route) => route.fulfill({ json: {
    countrySlug: "singapore", imageQuality: null, locked: false
  } }));
  await page.goto("/singapore/config");
  const about = page.getByRole("link", { name: "Where this info comes from", exact: true });
  const controls = [
    page.getByRole("button", { name: /Back to countries/ }),
    page.getByRole("button", { name: /Reset Generated Visuals/ }),
    page.getByRole("button", { name: "Action guide", exact: true }),
    about,
    page.getByRole("tab", { name: /^Research themes/ }),
    page.getByRole("combobox", { name: "Illustration detail", exact: true })
  ];
  for (const control of controls) {
    await control.hover();
    const colors = await control.evaluate((element) => {
      const rgb = (value) => value.match(/[\d.]+/g).map(Number);
      const blend = (foreground, background) => foreground.slice(0, 3).map((channel, index) =>
        channel * (foreground[3] ?? 1) + background[index] * (1 - (foreground[3] ?? 1)));
      const ancestors = [];
      for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
      const background = ancestors.reduce((color, ancestor) =>
        blend(rgb(getComputedStyle(ancestor).backgroundColor), color), [255, 255, 255]);
      const foreground = blend(rgb(getComputedStyle(element).color), background);
      const luminance = (color) => color.map((channel) => {
        const linear = channel / 255;
        return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
      }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const values = [luminance(foreground), luminance(background)];
      return { background, contrast: (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05) };
    });
    expect(colors.contrast, await control.getAttribute("aria-label") || await control.innerText()).toBeGreaterThanOrEqual(4.5);
    expect(Math.min(...colors.background)).toBeGreaterThan(200);
  }
  await about.hover();
  await expect(about).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(about).toHaveCSS("border-top-width", "0px");
  await page.screenshot({ path: test.info().outputPath("config-hover.png"), fullPage: true });
  await about.click();
  const dialog = page.getByRole("dialog", { name: "About the travel info", exact: true });
  await expect(dialog.getByRole("heading", { name: "The places and descriptions" })).toBeVisible();
  await expect(dialog.getByText(/It does not mean the details were checked recently/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("config-about-data.png"), fullPage: true });
  expect(unexpectedRequests).toEqual([]);
});

async function checkCountryActions(page) {
  const back = page.getByRole("button", { name: /Back to countries/ });
  const openMap = page.getByRole("button", { name: /Open Singapore map/ });
  const reset = page.getByRole("button", { name: /Reset Generated Visuals/ });
  for (const button of [back, openMap, reset]) {
    await expect(button).toBeInViewport();
    await button.click({ trial: true });
  }
  const navigation = page.getByRole("navigation", { name: "Atlas navigation" });
  await expect(navigation.getByRole("button")).toHaveCount(4);
  await expect(navigation.getByRole("link", { name: "RoamAtlas home" })).toHaveCount(0);
  await expect(page.locator("footer").getByRole("link", { name: "RoamAtlas home" })).toHaveCount(1);
  const backBounds = await back.boundingBox();
  const resetPosition = await reset.boundingBox();
  expect(Math.abs(backBounds.y - resetPosition.y)).toBeLessThan(2);
  expect(resetPosition.x).toBeGreaterThanOrEqual(backBounds.x + backBounds.width);
  const guide = page.getByRole("button", { name: "Action guide", exact: true });
  await expect(guide).toHaveText("i");
  const guideBounds = await guide.boundingBox();
  expect(Math.abs(guideBounds.y - resetPosition.y)).toBeLessThan(2);
  expect(guideBounds.x).toBeGreaterThanOrEqual(resetPosition.x + resetPosition.width);
  await guide.click();
  const help = page.getByRole("region", { name: "Country action legend" });
  await expect(help).toBeVisible();
  const resetBounds = await reset.boundingBox();
  const helpBounds = await help.boundingBox();
  expect(helpBounds.y).toBeGreaterThanOrEqual(resetBounds.y + resetBounds.height);
  // Visibility alone misses an overlay. Trial clicks assert actual hit targets.
  for (const button of [back, openMap, reset]) {
    await button.click({ trial: true });
  }
  await page.screenshot({ path: test.info().outputPath("config-actions-help.png"), fullPage: true });
  await guide.click();
  await back.scrollIntoViewIfNeeded();
}

test("recovers thumbnail failures and reloads photos when returning to the editor tab", async ({ page }) => {
  const unexpectedRequests = await isolateSetupRequests(page);
  let requests = 0;
  let retryRequest = false;
  let recover = false;
  await page.route("**/api/place-image?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("place") === firstChapter.name) {
      requests++;
      if (recover) retryRequest = url.searchParams.get("retryMissing") === "1";
      if (!recover) {
        await route.fulfill({ status: 404, body: "Photo unavailable" });
        return;
      }
    }
    await route.fulfill({ path: artworkPath, contentType: "image/jpeg" });
  });
  await openSetup(page);
  const photo = page.getByRole("button", { name: new RegExp(`^Reference photo for ${firstChapter.name}:`) });
  await expect(photo).toHaveAttribute("data-photo-state", "failed", { timeout: 8000 });
  expect(requests).toBe(3);
  await expect(photo.locator(".draft-photo-spinner")).toBeHidden();
  await expect(photo).toHaveAttribute("title", "Photo unavailable. Click to retry.");
  recover = true;
  await photo.click();
  await expect(photo).toHaveAttribute("data-photo-state", "ready");
  expect(requests).toBe(4);
  expect(retryRequest).toBe(true);

  await page.getByRole("tab", { name: /^Research themes/ }).click();
  await expect(photo).toHaveCount(0);
  await page.getByRole("tab", { name: /^Candidate regions/ }).click();
  await expect(photo).toHaveAttribute("data-photo-state", "ready");
  const photos = page.locator("[data-draft-place-photo]");
  await expect(photos).toHaveCount(draft.regions.length);
  for (const thumbnail of await photos.all()) {
    await expect(thumbnail).toHaveAttribute("data-photo-state", "ready");
    await expect(thumbnail.locator(".draft-photo-spinner")).toBeHidden();
  }
  expect(unexpectedRequests).toEqual([]);
});

test("opens the editable contents directly and keeps one layout while reviewing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const unexpectedRequests = await isolateSetupRequests(page);
  await openSetup(page);
  await checkCountryActions(page);

  const contents = page.getByRole("region", { name: "Scrollable atlas contents" });
  await expect(page.getByRole("button", { name: "Edit & review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "← Back to contents", exact: true })).toHaveCount(0);
  await expect(contents.getByRole("button", { name: "Edit starter map with GenAI", exact: true })).toBeVisible();
  const approval = contents.getByRole("button", { name: `Unapprove ${firstChapter.name}`, exact: true });
  await expect(approval).toBeVisible();
  await expect(contents.getByText(firstChild.name, { exact: true })).toBeVisible();

  const chapters = contents.locator(".draft-list").first().locator(":scope > li");
  await expect(chapters).toHaveCount(draft.regions.length);
  const firstBounds = await chapters.nth(0).boundingBox();
  const secondBounds = await chapters.nth(1).boundingBox();
  expect(secondBounds.y).toBeGreaterThanOrEqual(firstBounds.y + firstBounds.height);
  const contentsBounds = await contents.boundingBox();
  expect(firstBounds.width).toBeGreaterThanOrEqual(contentsBounds.width - 4);

  const themes = page.getByRole("tab", { name: /^Research themes/ });
  await themes.click();
  await expect(themes).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /^Research themes/ })).toBeVisible();
  await expect(contents.getByText(draft.themes[0].label, { exact: true })).toBeVisible();
  await themes.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: /^Candidate regions/ })).toBeFocused();
  await expect(approval).toBeVisible();

  await contents.getByRole("button", { name: "Edit starter map with GenAI", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit starter map with GenAI", exact: true });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole("button", { name: "Close GenAI edit modal", exact: true }).click();
  await expect(editDialog).toBeHidden();
  await expect(approval).toBeVisible();

  const editorWidth = await contents.evaluate((element) => ({
    contentWidth: element.scrollWidth,
    availableWidth: element.clientWidth
  }));
  expect(editorWidth.contentWidth).toBeLessThanOrEqual(editorWidth.availableWidth + 1);
  const pageScroll = page.locator("#country-shell");
  await pageScroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const title = contents.getByRole("heading", { name: "Singapore", level: 1, exact: true });
  await expect(title).toBeInViewport();
  const titleBounds = await title.boundingBox();
  const stickyHeaderBounds = await page.locator(".country-draft-header").boundingBox();
  const shellPadding = await pageScroll.evaluate((element) => parseFloat(getComputedStyle(element).paddingTop));
  expect(stickyHeaderBounds.y).toBeLessThanOrEqual(shellPadding + 1);
  expect(titleBounds.y).toBeGreaterThanOrEqual(0);
  expect(titleBounds.y + titleBounds.height).toBeLessThanOrEqual(stickyHeaderBounds.y + stickyHeaderBounds.height);
  await contents.getByRole("link", { name: "Where this info comes from", exact: true }).click({ trial: true });
  await pageScroll.evaluate((element) => { element.scrollTop = 0; });
  await page.getByRole("button", { name: "Open starter-map actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Rebuild starter info/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Reset photos/ })).toBeVisible();
  await page.getByRole("button", { name: "Open starter-map actions", exact: true }).click();
  await expect(page.getByRole("link", { name: "Where this info comes from", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Singapore map/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reset Generated Visuals/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("config-desktop.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("tab", { name: /^Candidate regions/ })).toBeVisible();
  await expect(approval).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

test("uses one mobile scroll surface with accessible navigation and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unexpectedRequests = await isolateSetupRequests(page);
  await openSetup(page);
  await checkCountryActions(page);

  const back = page.getByRole("button", { name: /Back to countries/ });
  const openMap = page.getByRole("button", { name: /Open Singapore map/ });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeInViewport();
  await openMap.scrollIntoViewIfNeeded();
  await expect(openMap).toBeInViewport();

  const contents = page.getByRole("region", { name: "Scrollable atlas contents" });
  const firstPlace = contents.getByText(firstChild.name, { exact: true });
  await firstPlace.scrollIntoViewIfNeeded();
  await expect(firstPlace).toBeInViewport();
  await expect(contents.getByRole("button", { name: `Unapprove ${firstChapter.name}`, exact: true })).toBeVisible();
  const factNote = page.getByText("AI illustrates the atlas. Sources ground the facts.", { exact: true });
  await factNote.scrollIntoViewIfNeeded();
  await expect(factNote).toBeInViewport();
  const footerLogo = page.locator("footer").getByRole("link", { name: "RoamAtlas home" });
  await footerLogo.scrollIntoViewIfNeeded();
  await expect(footerLogo).toBeInViewport();

  const geometry = await page.locator("#country-shell").evaluate((shell) => {
    const scrollable = [...shell.querySelectorAll("*")].filter((element) => {
      const style = getComputedStyle(element);
      return /^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    });
    return {
      viewportWidth: innerWidth,
      shellWidth: shell.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      innerScrollRegions: scrollable.map((element) => element.getAttribute("aria-label") || element.className),
      scrollTop: shell.scrollTop,
      scrollHeight: shell.scrollHeight,
      clientHeight: shell.clientHeight
    };
  });
  expect(geometry.shellWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.innerScrollRegions).toEqual([]);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  expect(geometry.scrollTop).toBeGreaterThan(0);

  // Extend only the screenshot height to show the complete stacked layout.
  await page.setViewportSize({ width: 390, height: geometry.scrollHeight });
  await back.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("config-mobile.png"), fullPage: true });
  expect(unexpectedRequests).toEqual([]);
});

for (const width of [690, 850]) {
 test(`keeps the header compact and aligned at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 789 });
  const unexpectedRequests = await isolateSetupRequests(page);
  await openSetup(page);
  await checkCountryActions(page);
  const panel = page.getByRole("region", { name: "Atlas contents", exact: true });
  const navigation = page.getByRole("navigation", { name: "Atlas navigation" });
  const panelBounds = await panel.boundingBox();
  const navBounds = await navigation.boundingBox();
  expect(Math.abs(panelBounds.x - navBounds.x)).toBeLessThan(2);
  expect(panelBounds.width).toBeGreaterThanOrEqual(navBounds.width - 2);
  const horizontalOverflow = await page.locator("#country-shell").evaluate((shell) => shell.scrollWidth > shell.clientWidth);
  expect(horizontalOverflow).toBe(false);
  const openMap = await page.getByRole("button", { name: /Open Singapore map/ }).boundingBox();
  const back = await page.getByRole("button", { name: /Back to countries/ }).boundingBox();
  expect(Math.abs(openMap.y - back.y)).toBeLessThan(2);
  expect(back.width).toBeLessThan(width / 3);
  const hero = await page.locator(".country-config-hero").boundingBox();
  const quality = await page.getByRole("combobox", { name: "Illustration detail" }).boundingBox();
  expect(quality.x).toBeGreaterThanOrEqual(hero.x + hero.width);
  expect(quality.y).toBeLessThan(hero.y + hero.height);
  await expect(page.getByRole("heading", { name: "Inside the atlas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit & review", exact: true })).toHaveCount(0);
  const chapters = page.locator(".draft-list").first().locator(":scope > li");
  const first = await chapters.nth(0).boundingBox();
  const second = await chapters.nth(1).boundingBox();
  expect(first.y).toBeLessThan(789 * 0.6);
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  expect(first.width).toBeGreaterThanOrEqual(panelBounds.width - 4);
  if (width === 690) {
    const header = await page.locator(".country-draft-header").boundingBox();
    await page.screenshot({
      path: test.info().outputPath("config-header.png"),
      clip: { x: header.x, y: header.y, width: header.width, height: header.height }
    });
  }
  await page.screenshot({ path: test.info().outputPath(`config-${width}.png`), fullPage: true });
  expect(unexpectedRequests).toEqual([]);
 });
}

for (const width of [320, 560, 600]) {
  test(`keeps controls usable around the phone breakpoint at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const unexpectedRequests = await isolateSetupRequests(page);
    await openSetup(page);
    await checkCountryActions(page);
    const shell = page.locator("#country-shell");
    expect(await shell.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const title = page.getByRole("heading", { name: "Singapore", level: 1 });
    await expect(title).toBeVisible();
    const titleBounds = await title.boundingBox();
    expect(titleBounds.height).toBeLessThan(45);
    expect(unexpectedRequests).toEqual([]);
  });
}

for (const width of [320, 390, 690]) {
  test(`selects illustration detail from the styled menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const unexpectedRequests = await isolateSetupRequests(page);
    await page.route("**/api/artwork/quality-lock**", (route) => route.fulfill({ json: {
      countrySlug: "singapore", imageQuality: null, locked: false
    } }));
    await page.goto("/singapore/config");
    const quality = page.getByRole("combobox", { name: "Illustration detail", exact: true });
    await expect(quality).toBeEnabled();
    await quality.click();
    const menu = page.getByRole("listbox", { name: "Illustration detail", exact: true });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option")).toHaveCount(3);
    await expect(menu.getByRole("option", { name: "High", exact: true })).toHaveAttribute("aria-selected", "true");
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: test.info().outputPath("config-quality-dropdown.png"), fullPage: true });
    await quality.press("m");
    await quality.press("Enter");
    await expect(quality).toHaveText("Medium");
    await expect(menu).toBeHidden();
    await expect(quality).toBeFocused();
    await quality.press("ArrowDown");
    await expect(menu).toBeVisible();
    await quality.press("Escape");
    await expect(menu).toBeHidden();
    await expect(quality).toHaveText("Medium");
    await quality.click();
    await page.getByRole("heading", { name: "Singapore", level: 1 }).click();
    await expect(menu).toBeHidden();
    await quality.focus();
    await quality.press("ArrowDown");
    await quality.press("Tab");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("tab", { name: /^Candidate regions/ })).toBeFocused();
    await page.reload();
    await expect(quality).toHaveText("Medium");
    expect(unexpectedRequests).toEqual([]);
  });
}
