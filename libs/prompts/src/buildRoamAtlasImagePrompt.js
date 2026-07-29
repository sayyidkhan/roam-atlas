import { buildHomepagePrompt } from "./buildHomepagePrompt.js";
import { buildRegionPrompt } from "./buildRegionPrompt.js";
import { buildEncyclopediaPrompt } from "./buildEncyclopediaPrompt.js";

export function buildRoamAtlasImagePrompt(input) {
  if (input.pageType === "homepage_overview" || input.zoomLevel === 0) {
    return buildHomepagePrompt({
      ...input,
      pageType: "homepage_overview",
      zoomLevel: 0,
      density: "minimal"
    });
  }

  if (
    input.pageType === "architectural_detail" ||
    input.pageType === "natural_history_detail" ||
    input.pageType === "animal_anatomy_plate" ||
    input.pageType === "food_anatomy_plate" ||
    input.pageType === "cultural_object_plate" ||
    input.zoomLevel >= 3
  ) {
    return buildEncyclopediaPrompt(input);
  }

  return buildRegionPrompt(input);
}
