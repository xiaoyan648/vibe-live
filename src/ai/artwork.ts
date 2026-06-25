import { DEFAULT_ARK_BASE_URL, type AiRequestConfig } from "./client";
import { sanitizeUserAiConfig } from "./userConfig";
import type { Vibe, VibeArtwork } from "@/data/vibes";

const DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-260128";
const DEFAULT_IMAGE_SIZE = "2048x2048";
const DEFAULT_OPENAI_IMAGE_SIZE = "1024x1024";

interface ArtworkVibeInput {
  id?: string;
  name?: string;
  subtitle?: string;
  tagline?: string;
  glyph?: string;
  visual?: Vibe["visual"];
  palette?: Vibe["palette"];
  params?: Partial<Vibe["params"]>;
}

interface ImageGenerationResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

function compactText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 240) : fallback;
}

function clamp01(value: unknown, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, number));
}

function readEnv(name: string) {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function imageBaseUrl(requestConfig?: AiRequestConfig) {
  const override = sanitizeUserAiConfig(requestConfig);
  return (
    override.baseURL ||
    readEnv("OPENAI_IMAGE_BASE_URL") ||
    readEnv("ARK_IMAGE_BASE_URL") ||
    readEnv("OPENAI_BASE_URL") ||
    readEnv("ARK_BASE_URL") ||
    (readEnv("ARK_API_KEY") ? DEFAULT_ARK_BASE_URL : "https://api.openai.com/v1")
  ).replace(/\/+$/, "");
}

function defaultImageSizeForModel(model: string) {
  return model.toLowerCase().includes("gpt-image") ? DEFAULT_OPENAI_IMAGE_SIZE : DEFAULT_IMAGE_SIZE;
}

export function buildArtworkPrompt(vibe: ArtworkVibeInput, userPrompt: string) {
  const name = compactText(vibe.name, "自制氛围");
  const subtitle = compactText(vibe.subtitle, "AI Vibe");
  const tagline = compactText(vibe.tagline, userPrompt);
  const visual = compactText(vibe.visual, "particles");
  const palette = vibe.palette ?? { accent: "#8b5cf6", accent2: "#22d3ee", base: "#070812" };
  const energy = clamp01(vibe.params?.energy, 0.45);
  const space = clamp01(vibe.params?.space, 0.72);
  const warmth = clamp01(vibe.params?.warmth, 0.55);

  return [
    "Create one square album-cover artwork for a browser music player.",
    "The same image must work as a clear vinyl cover, a circular record label crop, and a blurred full-screen background.",
    "No text, no logo, no watermark, no UI, no readable letters.",
    "Use a centered focal composition with strong silhouette, premium editorial lighting, tactile texture, cinematic depth, and clean negative space.",
    `Scene prompt: ${compactText(userPrompt, tagline)}`,
    `Vibe title: ${name} / ${subtitle}. Tagline: ${tagline}. Visual mode: ${visual}.`,
    `Palette: deep base ${palette.base}, accent ${palette.accent}, secondary accent ${palette.accent2}.`,
    `Music feel: energy ${energy.toFixed(2)}, space ${space.toFixed(2)}, warmth ${warmth.toFixed(2)}.`,
    "Style: high-end music artwork, atmospheric, modern, vivid but not noisy, polished for a premium audio product.",
  ].join("\n");
}

export async function generateArtworkForVibe(
  vibe: ArtworkVibeInput,
  userPrompt: string,
  requestConfig?: AiRequestConfig,
): Promise<VibeArtwork> {
  const override = sanitizeUserAiConfig(requestConfig);
  const apiKey = override.apiKey || readEnv("OPENAI_API_KEY") || readEnv("ARK_API_KEY");
  const model = override.model || readEnv("OPENAI_IMAGE_MODEL") || readEnv("ARK_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL;
  const size = readEnv("OPENAI_IMAGE_SIZE") || readEnv("ARK_IMAGE_SIZE") || defaultImageSizeForModel(model);
  const responseFormat =
    readEnv("OPENAI_IMAGE_RESPONSE_FORMAT") ||
    readEnv("ARK_IMAGE_RESPONSE_FORMAT") ||
    (model.toLowerCase().includes("gpt-image") ? "" : "url");

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or ARK_API_KEY");
  }

  const prompt = buildArtworkPrompt(vibe, userPrompt);
  const body = {
    model,
    prompt,
    size,
    n: 1,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  };

  const payload =
    typeof window !== "undefined" && window.vibeLiveOpenAI
      ? await window.vibeLiveOpenAI.imagesGenerate({
          apiKey,
          baseURL: imageBaseUrl(requestConfig),
          body,
        })
      : await fetch(`${imageBaseUrl(requestConfig)}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90_000),
        }).then(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as ImageGenerationResponse;
          if (!response.ok) {
            throw new Error(payload.error?.message || `Artwork generation failed with ${response.status}`);
          }
          return payload;
        });

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const imageItem = payload.data?.find((item) => item.url || item.b64_json);
  const imageUrl = imageItem?.url || (imageItem?.b64_json ? `data:image/png;base64,${imageItem.b64_json}` : "");
  if (!imageUrl) {
    throw new Error("Artwork generation returned no image data");
  }

  return {
    imageUrl,
    prompt,
    model,
    createdAt: new Date().toISOString(),
  };
}
