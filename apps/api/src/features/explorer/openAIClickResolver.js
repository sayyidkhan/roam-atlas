import { readFile } from "node:fs/promises";

import { mimeTypeForImagePath } from "../../platform/http/mediaTypes.js";
import { annotateClickPointOnPng } from "./clickMarkerPng.js";

export function createOpenAIClickResolver({
  apiKey,
  model,
  defaultCountrySlug,
  getCountryPack,
  getSceneArtwork,
  getImagePathFromUrl,
  fetchFn = fetch
}) {
  return async function resolveClickPhrase({
    sceneId,
    countrySlug = defaultCountrySlug,
    imageUrl,
    normalizedClick,
    imageClick,
    point
  }) {
    if (!apiKey) {
      return {
        status: "provider_missing",
        phrase: null,
        reason: "OPENAI_API_KEY is not configured, so true VLM resolving is unavailable."
      };
    }

    const pack = getCountryPack(countrySlug) ?? getCountryPack(defaultCountrySlug);
    const fallbackSceneId = pack?.overviewSceneId;
    const artwork = imageUrl
      ? { imageUrl }
      : getSceneArtwork(sceneId) ??
        (fallbackSceneId ? getSceneArtwork(fallbackSceneId) : null);
    if (!artwork?.imageUrl) {
      return {
        status: "image_missing",
        phrase: null,
        reason: `No generated artwork is registered for ${sceneId}.`
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
      sceneId,
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

    const payload = await response.json();
    const text =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.text)?.text ??
      "{}";
    try {
      return {
        status: "resolved",
        imageMarked: Boolean(markedImage),
        ...JSON.parse(text)
      };
    } catch {
      return {
        status: "resolved",
        phrase: text,
        confidence: "low",
        imageMarked: Boolean(markedImage),
        reason: "Model returned non-JSON text."
      };
    }
  };
}

function buildClickPrompt({
  sceneId,
  pack,
  normalizedClick,
  imageClick,
  point,
  imageMarked
}) {
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

function getSceneCandidateText(sceneId, pack) {
  const scene = pack.scenes[sceneId];
  const rootNode = pack.nodes[scene?.rootNodeId];
  const labels = (rootNode?.childIds ?? [])
    .map((nodeId) => pack.nodes[nodeId]?.title)
    .filter(Boolean);
  return labels.length
    ? `Known RoamAtlas candidate labels for this page: ${labels.join(", ")}.`
    : "Known RoamAtlas candidate labels: none.";
}
