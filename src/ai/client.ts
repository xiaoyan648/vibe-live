import OpenAI from "openai";
import { sanitizeUserAiConfig, type UserAiConfig } from "./userConfig";

export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export type AiRequestConfig = Partial<UserAiConfig>;

export function getAiConfig(requestConfig?: AiRequestConfig) {
  const override = sanitizeUserAiConfig(requestConfig);
  const apiKey = override.apiKey || process.env.OPENAI_API_KEY || process.env.ARK_API_KEY;
  const model = override.model || process.env.OPENAI_MODEL || process.env.ARK_MODEL;
  const baseURL =
    override.baseURL ||
    process.env.OPENAI_BASE_URL ||
    process.env.ARK_BASE_URL ||
    (process.env.ARK_API_KEY ? DEFAULT_ARK_BASE_URL : undefined);

  return { apiKey, baseURL, model };
}

export function createOpenAIClient(requestConfig?: AiRequestConfig) {
  const { apiKey, baseURL } = getAiConfig(requestConfig);

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or ARK_API_KEY");
  }

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    // Structured vibe generation (json_schema + visualCode) often takes 60-90s.
    timeout: 120_000,
    maxRetries: 0,
  });
}
