import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDefaultArtworkPageForScene } from "../src/data/defaultArtworkPages.js";
import { scrollScenes } from "../src/data/sceneGraph.js";
import {
  DEFAULT_FAL_IMAGE_MODEL,
  DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT,
  generateTileImageWithFal,
  normalizeFalImageModel
} from "../src/domain/imageProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const env = await loadDotEnv(path.join(root, ".env"));

const apiKey = process.env.FAL_KEY ?? env.FAL_KEY;
if (!apiKey) {
  throw new Error("FAL_KEY is required. Add it to .env or export it before running this script.");
}

const page = getDefaultArtworkPageForScene("singapore-overview", scrollScenes);
const model = normalizeFalImageModel(
  process.env.WANDERSG_IMAGE_MODEL ?? env.WANDERSG_IMAGE_MODEL ?? DEFAULT_FAL_IMAGE_MODEL
);
const aspectRatio = process.env.WANDERSG_IMAGE_ASPECT_RATIO ?? env.WANDERSG_IMAGE_ASPECT_RATIO ?? "16:9";
const resolution = process.env.WANDERSG_IMAGE_RESOLUTION ?? env.WANDERSG_IMAGE_RESOLUTION ?? "2K";
const outputDir = path.join(root, "public", "generated", "scenes", "singapore-overview");
const imagePath = path.join(outputDir, "overview-codex-local.png");
const metadataPath = path.join(outputDir, "overview-codex-local.json");

await mkdir(outputDir, { recursive: true });

const generated = await generateTileImageWithFal({
  apiKey,
  model,
  prompt: page.plan.imagePrompt,
  aspectRatio,
  resolution,
  systemPrompt:
    process.env.WANDERSG_IMAGE_SYSTEM_PROMPT ??
    env.WANDERSG_IMAGE_SYSTEM_PROMPT ??
    DEFAULT_WANDERSG_IMAGE_SYSTEM_PROMPT
});

await writeFile(imagePath, Buffer.from(generated.b64Json, "base64"));
await writeFile(
  metadataPath,
  `${JSON.stringify(
    {
      pageId: page.id,
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      imageProvider: "fal",
      imageModel: generated.model,
      aspectRatio,
      resolution,
      imageUrl: "./public/generated/scenes/singapore-overview/overview-codex-local.png",
      prompt: page.plan.imagePrompt,
      revisedPrompt: generated.revisedPrompt,
      generatedAt: new Date().toISOString(),
      factBoundary: "Generated homepage art is visual only; clicks still resolve through VLM and curated node matching."
    },
    null,
    2
  )}\n`
);

console.log(`Generated homepage art with ${generated.model}: ${imagePath}`);

async function loadDotEnv(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}
