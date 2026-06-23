import { NextResponse } from "next/server";
import { getMaxConversationMessages, normalizeConversationHistory } from "@/ai/conversation";
import { generateVibeFromPrompt, regenerateVibeFromPrompt } from "@/ai/generate";
import { fallbackGeneratedVibe } from "@/ai/schema";
import { sanitizeUserAiConfig } from "@/ai/userConfig";
import { REGENERATE_TARGETS, type RegenerateTarget } from "@/data/regeneration";
import { enforceMusicQuality } from "@/music/quality";

export const runtime = "nodejs";
export const maxDuration = 120;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const buckets = new Map<string, { count: number; resetAt: number }>();
const REGENERATE_TARGET_SET = new Set<RegenerateTarget>(REGENERATE_TARGETS);

function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

function isProviderAuthError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = error instanceof Error ? error.message : String(error);
  return (
    record.status === 401 ||
    record.statusCode === 401 ||
    message.includes("401") ||
    message.includes("Unauthorized") ||
    message.includes("auth.unauthorized")
  );
}

function isMissingAiConfig(message: string) {
  return (
    message.includes("Missing OPENAI_API_KEY") ||
    message.includes("Missing OPENAI_MODEL") ||
    message.includes("Missing ARK_")
  );
}

export async function POST(request: Request) {
  let promptForFallback = "";

  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: "不允许的请求来源。" }, { status: 403 });
    }

    if (!consumeRateLimit(getClientKey(request))) {
      return NextResponse.json({ error: "生成太频繁了，请稍后再试。" }, { status: 429 });
    }

    const body = (await request.json()) as {
      prompt?: unknown;
      conversationHistory?: unknown;
      maxConversationMessages?: unknown;
      aiConfig?: unknown;
      baseVibe?: unknown;
      regenerateTarget?: unknown;
    };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    promptForFallback = prompt;

    if (prompt.length < 3) {
      return NextResponse.json({ error: "请至少描述 3 个字符的氛围。" }, { status: 400 });
    }

    if (prompt.length > 600) {
      return NextResponse.json({ error: "描述太长了，请控制在 600 字以内。" }, { status: 400 });
    }

    const regenerateTarget =
      typeof body.regenerateTarget === "string" && REGENERATE_TARGET_SET.has(body.regenerateTarget as RegenerateTarget)
        ? (body.regenerateTarget as RegenerateTarget)
        : undefined;
    const maxConversationMessages = Math.min(
      getMaxConversationMessages(),
      getMaxConversationMessages(body.maxConversationMessages),
    );
    const conversationHistory = normalizeConversationHistory(body.conversationHistory, maxConversationMessages);
    const generationOptions = {
      conversationHistory,
      maxConversationMessages,
      aiConfig: sanitizeUserAiConfig(body.aiConfig),
    };
    const result =
      body.baseVibe && regenerateTarget
        ? await regenerateVibeFromPrompt(prompt, body.baseVibe, regenerateTarget, generationOptions)
        : await generateVibeFromPrompt(prompt, generationOptions);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";

    if (isProviderAuthError(error)) {
      const quality = enforceMusicQuality(promptForFallback, fallbackGeneratedVibe(promptForFallback));
      return NextResponse.json(
        {
          vibe: quality.vibe,
          repaired: quality.report.repaired,
          fallback: true,
          stages: [
            { id: "agent", label: "轻量 Agent", status: "fallback" },
            {
              id: "quality",
              label: quality.report.repaired
                ? `音乐质量校验 · 已修复 ${quality.report.issues.length} 项`
                : `音乐质量校验 · ${quality.report.score}`,
              status: quality.report.repaired ? "repaired" : "completed",
            },
          ],
          warning: "AI 服务鉴权失败，已使用本地 fallback 生成。请检查本地 AI 配置，或开发环境的 OPENAI_* / ARK_* 配置。",
        },
        { status: 200 },
      );
    }

    const missingConfig = isMissingAiConfig(message);
    const status = missingConfig ? 500 : 502;

    return NextResponse.json(
      {
        error: missingConfig
          ? "AI 配置未完成，请填写本地 API Key、Base URL 与 Model；开发环境也可使用 OPENAI_* / ARK_* 变量。"
          : "AI 生成暂时失败，请稍后再试。",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status },
    );
  }
}
