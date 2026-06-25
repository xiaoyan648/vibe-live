import OpenAI from "openai";
import { sanitizeUserAiConfig, type SanitizedUserAiConfig } from "./userConfig";

export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export type AiRequestConfig = SanitizedUserAiConfig;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function readEnv(name: string) {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

export function getAiConfig(requestConfig?: AiRequestConfig) {
  const override = sanitizeUserAiConfig(requestConfig);
  const apiKey = override.apiKey || readEnv("OPENAI_API_KEY") || readEnv("ARK_API_KEY");
  const model = override.model || readEnv("OPENAI_MODEL") || readEnv("ARK_MODEL");
  const baseURL =
    override.baseURL ||
    readEnv("OPENAI_BASE_URL") ||
    readEnv("ARK_BASE_URL") ||
    (readEnv("ARK_API_KEY") ? DEFAULT_ARK_BASE_URL : undefined);

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
    dangerouslyAllowBrowser: true,
    // Structured vibe generation (json_schema + visualCode) often takes 60-90s.
    timeout: 120_000,
    maxRetries: 0,
  });
}

export async function createChatCompletion(
  requestConfig: AiRequestConfig | undefined,
  body: unknown,
): Promise<ChatCompletionResponse> {
  const { apiKey, baseURL } = getAiConfig(requestConfig);

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or ARK_API_KEY");
  }

  if (typeof window !== "undefined" && window.vibeLiveOpenAI) {
    return window.vibeLiveOpenAI.chatCompletionsCreate({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      body,
    });
  }

  const client = createOpenAIClient(requestConfig);
  return client.chat.completions.create(body as Parameters<typeof client.chat.completions.create>[0]) as Promise<ChatCompletionResponse>;
}
