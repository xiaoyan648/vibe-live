import OpenAI from "openai";

export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export function getAiConfig() {
  const apiKey = process.env.ARK_API_KEY;
  const model = process.env.ARK_MODEL;
  const baseURL = process.env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL;

  return { apiKey, baseURL, model };
}

export function createOpenAIClient() {
  const { apiKey, baseURL } = getAiConfig();

  if (!apiKey) {
    throw new Error("Missing ARK_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL,
    // Structured vibe generation (json_schema + visualCode) often takes 60-90s.
    timeout: 120_000,
    maxRetries: 0,
  });
}
