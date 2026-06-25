export interface UserAiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  imageTool: UserImageToolConfig;
}

export interface UserImageToolConfig {
  enabled: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
}

export type SanitizedUserAiConfig = Partial<Omit<UserAiConfig, "imageTool">> & {
  imageTool?: Partial<UserImageToolConfig>;
};

export const USER_AI_CONFIG_STORAGE_KEY = "vibelive:user-ai-config:v1";
export const DEFAULT_USER_AI_CONFIG: UserAiConfig = {
  apiKey: "",
  baseURL: "https://api.openai.com/v1",
  model: "",
  imageTool: {
    enabled: false,
    apiKey: "",
    baseURL: "https://api.openai.com/v1",
    model: "",
  },
};

function compactString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function sanitizeUserAiConfig(input: unknown): SanitizedUserAiConfig {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  const rawImageTool = record.imageTool && typeof record.imageTool === "object" ? (record.imageTool as Record<string, unknown>) : {};

  return {
    apiKey: compactString(record.apiKey, 4096),
    baseURL: compactString(record.baseURL, 512).replace(/\/+$/, ""),
    model: compactString(record.model, 160),
    imageTool: {
      enabled: rawImageTool.enabled === true,
      apiKey: compactString(rawImageTool.apiKey, 4096),
      baseURL: compactString(rawImageTool.baseURL, 512).replace(/\/+$/, ""),
      model: compactString(rawImageTool.model, 160),
    },
  };
}

export function mergeUserAiConfig(input: unknown): UserAiConfig {
  const sanitized = sanitizeUserAiConfig(input);
  const imageTool = sanitized.imageTool ?? {};
  return {
    apiKey: sanitized.apiKey || DEFAULT_USER_AI_CONFIG.apiKey,
    baseURL: sanitized.baseURL || DEFAULT_USER_AI_CONFIG.baseURL,
    model: sanitized.model || DEFAULT_USER_AI_CONFIG.model,
    imageTool: {
      enabled: imageTool.enabled ?? DEFAULT_USER_AI_CONFIG.imageTool.enabled,
      apiKey: imageTool.apiKey || DEFAULT_USER_AI_CONFIG.imageTool.apiKey,
      baseURL: imageTool.baseURL || DEFAULT_USER_AI_CONFIG.imageTool.baseURL,
      model: imageTool.model || DEFAULT_USER_AI_CONFIG.imageTool.model,
    },
  };
}

export function hasUsableUserAiConfig(input: Partial<UserAiConfig> | null | undefined) {
  return Boolean(input?.apiKey?.trim() && input.model?.trim());
}

export function hasUsableImageToolConfig(input: Partial<UserAiConfig> | null | undefined) {
  return Boolean(input?.imageTool?.enabled && input.imageTool.apiKey?.trim() && input.imageTool.model?.trim());
}

export function loadUserAiConfig(): UserAiConfig {
  if (typeof window === "undefined") return DEFAULT_USER_AI_CONFIG;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USER_AI_CONFIG_STORAGE_KEY) || "{}") as unknown;
    return mergeUserAiConfig(parsed);
  } catch {
    return DEFAULT_USER_AI_CONFIG;
  }
}

export function saveUserAiConfig(config: UserAiConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_AI_CONFIG_STORAGE_KEY, JSON.stringify(mergeUserAiConfig(config)));
}
