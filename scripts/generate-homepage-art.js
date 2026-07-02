import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDefaultArtworkPageForScene } from "../src/data/defaultArtworkPages.js";
import { scrollScenes } from "../src/data/sceneGraph.js";
import { resolveWandersgConfig } from "../src/config/wandersgConfig.js";
import {
  generateTileImageWithOpenAI,
  normalizeImageModel
} from "../src/domain/imageProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const env = await loadDotEnv(path.join(root, ".env"));
const appConfig = resolveWandersgConfig({ ...env, ...process.env });

const apiKey = process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required. Add it to .env or export it before running this script.");
}

const page = getDefaultArtworkPageForScene("singapore-overview", scrollScenes);
const model = normalizeImageModel(appConfig.image.model);
const size = appConfig.image.size;
const outputDir = path.join(root, "public", "generated", "scenes", "singapore-overview");
const imagePath = path.join(outputDir, "overview-codex-local.png");
const metadataPath = path.join(outputDir, "overview-codex-local.json");

await mkdir(outputDir, { recursive: true });

const generated = await generateTileImageWithOpenAI({
  apiKey,
  model,
  prompt: page.plan.imagePrompt,
  fallbackModel: appConfig.image.fallbackModel,
  size
});

await writeFile(imagePath, Buffer.from(generated.b64Json, "base64"));
await writeFile(
  metadataPath,
  `${JSON.stringify(
    {
      pageId: page.id,
      sceneId: page.sceneId,
      nodeId: page.nodeId,
      imageProvider: generated.provider,
      imageModel: generated.model,
      size,
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

console.log(`Generated homepage art with ${generated.provider}/${generated.model}: ${imagePath}`);

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
