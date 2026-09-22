import { readFile } from "node:fs/promises";

import type { CompiledCountryPack } from "../../data/countryPacks/serverRegistry.ts";
import type { SceneArtworkRecord } from "../../data/sceneArtwork.ts";
import { mimeTypeForImagePath } from "../../platform/http/mediaTypes.ts";
import {
  extractOpenAIText,
  parseJsonObject
} from "../../platform/openai/responseParsing.ts";
import { annotateClickPointOnPng } from "./clickMarkerPng.ts";

export type ClickPoint = {
  x: number;
  y: number;
};

export type ImageClick = {
  normalizedImage?: ClickPoint | null;
  objectFit?: string;
  pixel?: ClickPoint | null;
};

export type ClickPhraseRequest = {
  countrySlug?: string;
  imageClick?: ImageClick | null;
  imageUrl?: string | null;
  normalizedClick?: ClickPoint | null;
  point?: ClickPoint | null;
  sceneId?: string | null;
};

export type ClickPhraseResult = {
  confidence?: string | null;
  imageMarked?: boolean;
  phrase: string | null;
  reason?: string | null;
  status: string;
  [key: string]: unknown;
};

type OpenAIClickResolverDependencies = {
  apiKey?: string;
  defaultCountrySlug: string;
  fetchFn?: typeof fetch;
  getCountryPack: (
    countrySlug: string
  ) => CompiledCountryPack | null;
  getImagePathFromUrl: (imageUrl: string) => string | null;
  getSceneArtwork: (
    sceneId: string
  ) => SceneArtworkRecord | null;
  model: string;
  serviceTier?: "fast";
};

export function createOpenAIClickResolver({
  apiKey,
  model,
  serviceTier,
  defaultCountrySlug,
  getCountryPack,
  getSceneArtwork,
  getImagePathFromUrl,
  fetchFn = fetch
}: OpenAIClickResolverDependencies) {
  return async function resolveClickPhrase({
    sceneId,
    countrySlug = defaultCountrySlug,
    imageUrl,
    normalizedClick,
    imageClick,
    point
  }: ClickPhraseRequest): Promise<ClickPhraseResult> {
    if (!apiKey) {
      return {
        status: "provider_missing",
        phrase: null,
        reason: "OPENAI_API_KEY is not configured, so true VLM resolving is unavailable."
      };
    }

    const pack = getCountryPack(countrySlug) ?? getCountryPack(defaultCountrySlug);
    if (!pack) {
      return {
        status: "country_pack_missing",
        phrase: null,
        reason: `No country pack is registered for ${countrySlug}.`
      };
    }
    const fallbackSceneId = pack.overviewSceneId;
    const effectiveSceneId =
      sceneId ?? fallbackSceneId;
    const artwork = imageUrl
      ? { imageUrl }
      : (sceneId ? getSceneArtwork(sceneId) : null) ??
        (fallbackSceneId ? getSceneArtwork(fallbackSceneId) : null);
    if (!artwork?.imageUrl) {
      return {
        status: "image_missing",
        phrase: null,
        reason: `No generated artwork is registered for ${effectiveSceneId}.`
      };
    }

    const imagePath = getImagePathFromUrl(artwork.imageUrl);
    if (!imagePath) {
      return {
        status: "image_missing",
        phrase: null,
        reason: "Current page image path is outside the RoamAtlas workspace and runtime cache."
      };
    }

    const imageBytes = await readFile(imagePath);
    const clickPoint = imageClick?.normalizedImage ?? normalizedClick ?? null;
    const markedImage = clickPoint
      ? annotateClickPointOnPng(imageBytes, clickPoint.x, clickPoint.y)
      : null;
    const vlmImageBytes = markedImage?.bytes ?? imageBytes;
    const vlmMimeType =
      markedImage?.mimeType ?? mimeTypeForImagePath(imagePath);
    const prompt = buildClickPrompt({
      sceneId: effectiveSceneId,
      pack,
      normalizedClick,
      imageClick,
      point,
      imageMarked: Boolean(markedImage)
    });

    const response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        ...(serviceTier ? { service_tier: serviceTier } : {}),
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url:
                `data:${vlmMimeType};base64,${vlmImageBytes.toString("base64")}`,
              detail: "high"
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      return {
        status: "vlm_error",
        phrase: null,
        reason: await response.text()
      };
    }

    const text = extractOpenAIText(await response.json());
    const parsed = parseJsonObject(text);
    if (parsed) {
      return {
        status: "resolved",
        imageMarked: Boolean(markedImage),
        phrase:
          typeof parsed.phrase === "string"
            ? parsed.phrase
            : null,
        confidence:
          typeof parsed.confidence === "string"
            ? parsed.confidence
            : null,
        reason:
          typeof parsed.reason === "string"
            ? parsed.reason
            : null
      };
    }
    return {
      status: "resolved",
      phrase: text || null,
      confidence: "low",
      imageMarked: Boolean(markedImage),
      reason: "Model returned non-JSON text."
    };
  };
}

function buildClickPrompt({
  sceneId,
  pack,
  normalizedClick,
  imageClick,
  point,
  imageMarked
}: {
  imageClick?: ImageClick | null;
  imageMarked: boolean;
  normalizedClick?: ClickPoint | null;
  pack: CompiledCountryPack;
  point?: ClickPoint | null;
  sceneId: string;
}): string {
  const coordinateText = imageClick?.normalizedImage
    ? [
        `Click coordinates in original image pixels: x=${imageClick.pixel?.x}, y=${imageClick.pixel?.y}.`,
        `Click coordinates normalized to the original image: x=${imageClick.normalizedImage.x}, y=${imageClick.normalizedImage.y}.`,
        `The browser displayed this image with object-fit: ${imageClick.objectFit ?? "contain"}; use the original-image pixel coordinate, not the viewport coordinate.`
      ].join("\n")
    : normalizedClick
      ? `Click coordinates normalized to the visible viewport: x=${normalizedClick.x}, y=${normalizedClick.y}.`
      : `Click coordinates in displayed image space: x=${point?.x}, y=${point?.y}.`;
  const markerInstruction = imageMarked
    ? "A red crosshair with a white halo marks the user's click. Ignore the marker itself."
    : "No marker was drawn on this image. Use the supplied original-image coordinates to locate the user's click.";
  const targetInstruction = imageMarked
    ? `Describe only the exact visual subject under or closest to the crosshair in this illustrated ${pack.title} atlas image.`
    : `Describe only the exact visual subject at or closest to the supplied coordinates in this illustrated ${pack.title} atlas image.`;

  return [
    "You are RoamAtlas' click resolver.",
    markerInstruction,
    targetInstruction,
    "If the clicked region contains or is closest to one of the known RoamAtlas candidate labels, return that exact candidate label.",
    "Be specific. If the user clicked an infinity pool, roof garden, animal, dome, bridge, beach, canopy, food stall, or building part, name that visual subject.",
    getSceneCandidateText(sceneId, pack),
    "Do not make factual travel claims. Do not invent official names, opening hours, prices, routes, or live availability.",
    "Return JSON only with this shape:",
    '{"phrase":"short visual phrase","confidence":"low|medium|high","reason":"short reason"}',
    coordinateText,
    `Current country slug: ${pack.countrySlug}.`,
    `Current scene id: ${sceneId}.`
  ].join("\n");
}

function getSceneCandidateText(
  sceneId: string,
  pack: CompiledCountryPack
): string {
  const scene = pack.scenes[sceneId];
  const rootNode = pack.nodes[scene?.rootNodeId];
  const labels = (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId]?.title)
    .filter(Boolean);
  return labels.length
    ? `Known RoamAtlas candidate labels for this page: ${labels.join(", ")}.`
    : "Known RoamAtlas candidate labels: none.";
}
