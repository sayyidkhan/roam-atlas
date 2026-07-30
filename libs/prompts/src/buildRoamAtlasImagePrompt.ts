import { buildHomepagePrompt } from "./buildHomepagePrompt.ts";
import { buildRegionPrompt } from "./buildRegionPrompt.ts";
import { buildEncyclopediaPrompt } from "./buildEncyclopediaPrompt.ts";
import type {
  RoamAtlasPromptInput,
  RoamAtlasPromptOutput
} from "./roamAtlasPromptTypes.ts";

export function buildRoamAtlasImagePrompt(
  input: RoamAtlasPromptInput
): RoamAtlasPromptOutput {
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
