export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const DEFAULT_FAL_IMAGE_MODEL = "fal-ai/nano-banana-2";
export const DEFAULT_FAL_IMAGE_RESOLUTION = "2K";
export const DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT = `
You are the WanderSG Image Prompt Compiler and visual style director.

Always generate images in WanderSG's restrained flipbook encyclopedia style:
- clean isometric or lightly axonometric architectural planning illustration
- precise thin grey ink outlines
- flat muted pastel colors
- desaturated greens and pale blues
- light beige paths and roads
- generous spacing and clear object separation
- medium-low density
- calm urban planning proposal board feeling
- illustrated encyclopedia / museum guide page feeling

The image should feel like a clean Singapore visual encyclopedia page, not a
tourist poster, not a dense atlas, not a fantasy city, and not a children's book.

Short readable text is allowed only when it is supplied by WanderSG: page titles,
curated node names, short chapter labels, numbers, and one- to three-word callout
headings. Do not invent prices, opening hours, route times, official signage,
source citations, marketing copy, or long factual paragraphs.

Compose for a browser viewport. Keep important subjects, labels, callouts, and
faces inside the central 16:9 safe area. Use simple water, paper, lawn, road, or
sky-like areas near the outer edges so full-screen cover cropping does not cut
off the important content.
`.trim();

export function normalizeImageModel(model = DEFAULT_IMAGE_MODEL) {
  const value = String(model).trim();
  if (value === "image1" || value === "image-1" || value === "gpt image 1") {
    return "gpt-image-1";
  }
  if (value === "image2" || value === "image-2" || value === "gpt image 2") {
    return "gpt-image-2";
  }
  return value || DEFAULT_IMAGE_MODEL;
}

export function normalizeFalImageModel(model = DEFAULT_FAL_IMAGE_MODEL) {
  const value = String(model).trim();
  if (
    value === "nano-banana-2" ||
    value === "banana2" ||
    value === "nano banana 2" ||
    value === "nano-banana2"
  ) {
    return DEFAULT_FAL_IMAGE_MODEL;
  }
  return value || DEFAULT_FAL_IMAGE_MODEL;
}

export class ImageProviderNotConfiguredError extends Error {
  constructor(model = DEFAULT_IMAGE_MODEL) {
    super(
      `Image provider is not configured. Preferred model is ${model}; configure an explicit provider or fallback before generating tiles.`
    );
    this.name = "ImageProviderNotConfiguredError";
  }
}

export function createImageGenerationJob({ scene, tile, promptVersion }) {
  return {
    sceneId: scene.id,
    tileId: tile.id,
    row: tile.row,
    column: tile.column,
    bounds: tile.bounds,
    styleVersion: scene.styleVersion,
    dataVersion: scene.dataVersion,
    promptVersion,
    imageModel: tile.imageModel,
    basePrompt: tile.prompt,
    continuityPrompt: tile.continuityPrompt,
    neighborContext: tile.neighborContext ?? {}
  };
}

export async function generateTileImage() {
  throw new ImageProviderNotConfiguredError();
}

export async function generateTileImageWithOpenAI({
  apiKey,
  model = DEFAULT_IMAGE_MODEL,
  prompt,
  fallbackModel = process.env.WANDERSG_FALLBACK_IMAGE_MODEL ?? "gpt-image-1",
  size = DEFAULT_IMAGE_SIZE
}) {
  const requestedModel = normalizeImageModel(model);
  const requestedFallbackModel = fallbackModel ? normalizeImageModel(fallbackModel) : null;
  if (!apiKey) {
    throw new ImageProviderNotConfiguredError(requestedModel);
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: requestedModel,
      prompt,
      size,
      n: 1
    })
  });

  if (!response.ok) {
    const body = await response.text();
    if (shouldTryFallbackImageModel({ model: requestedModel, fallbackModel: requestedFallbackModel, body })) {
      return generateTileImageWithOpenAI({
        apiKey,
        model: requestedFallbackModel,
        fallbackModel: null,
        prompt,
        size
      });
    }
    throw new Error(`OpenAI image generation failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const image = payload.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenAI image generation returned no base64 image data.");
  }

  return {
    b64Json: image.b64_json,
    revisedPrompt: image.revised_prompt,
    model: requestedModel,
    size
  };
}

export async function generateTileImageWithFal({
  apiKey,
  model = DEFAULT_FAL_IMAGE_MODEL,
  prompt,
  aspectRatio = "16:9",
  resolution = DEFAULT_FAL_IMAGE_RESOLUTION,
  systemPrompt
}) {
  const requestedModel = normalizeFalImageModel(model);
  if (!apiKey) {
    throw new ImageProviderNotConfiguredError(requestedModel);
  }

  const response = await fetch(`https://fal.run/${requestedModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: "png",
      ...(systemPrompt ? { system_prompt: systemPrompt } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`fal image generation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const image = payload.images?.[0] ?? payload.image ?? payload.data?.images?.[0];
  const imageUrl = typeof image === "string" ? image : image?.url;
  if (!imageUrl) {
    throw new Error("fal image generation returned no image URL.");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`fal image download failed: ${imageResponse.status} ${await imageResponse.text()}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  return {
    b64Json: imageBuffer.toString("base64"),
    revisedPrompt: payload.revised_prompt ?? payload.prompt ?? null,
    model: requestedModel,
    size: `${aspectRatio} ${resolution}`,
    provider: "fal"
  };
}

function shouldTryFallbackImageModel({ model, fallbackModel, body }) {
  return (
    Boolean(fallbackModel) &&
    model !== fallbackModel &&
    body.includes("must be verified") &&
    body.includes(model)
  );
}
