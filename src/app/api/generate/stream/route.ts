import { getMaxConversationMessages, normalizeConversationHistory } from "@/ai/conversation";
import { generateVibeFromPrompt, regenerateVibeFromPrompt, type GenerationStage } from "@/ai/generate";
import { sanitizeUserAiConfig } from "@/ai/userConfig";
import { REGENERATE_TARGETS, type RegenerateTarget } from "@/data/regeneration";

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

function jsonLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "不允许的请求来源。" }, { status: 403 });
  }

  if (!consumeRateLimit(getClientKey(request))) {
    return Response.json({ error: "生成太频繁了，请稍后再试。" }, { status: 429 });
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
  const aiConfig = sanitizeUserAiConfig(body.aiConfig);
  const regenerateTarget =
    typeof body.regenerateTarget === "string" && REGENERATE_TARGET_SET.has(body.regenerateTarget as RegenerateTarget)
      ? (body.regenerateTarget as RegenerateTarget)
      : undefined;
  const maxConversationMessages = Math.min(
    getMaxConversationMessages(),
    getMaxConversationMessages(body.maxConversationMessages),
  );
  const conversationHistory = normalizeConversationHistory(body.conversationHistory, maxConversationMessages);

  if (prompt.length < 3) {
    return Response.json({ error: "请至少描述 3 个字符的氛围。" }, { status: 400 });
  }

  if (prompt.length > 600) {
    return Response.json({ error: "描述太长了，请控制在 600 字以内。" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(jsonLine({ ...payload, at: new Date().toISOString() })));
        } catch {
          closed = true;
        }
      };

      try {
        console.info("[vibelive:generate] accepted", { prompt });
        send({ type: "log", message: "刻录请求已接收" });

        const generationOptions = {
          aiConfig,
          conversationHistory,
          maxConversationMessages,
          onStage(stage: GenerationStage) {
            console.info("[vibelive:generate] stage", stage);
            send({ type: "stage", stage });
          },
        };
        const result =
          body.baseVibe && regenerateTarget
            ? await regenerateVibeFromPrompt(prompt, body.baseVibe, regenerateTarget, generationOptions)
            : await generateVibeFromPrompt(prompt, generationOptions);

        console.info("[vibelive:generate] completed", {
          fallback: result.fallback,
          repaired: result.repaired,
          stages: result.stages.map((stage) => `${stage.id}:${stage.status}`),
        });
        send({ type: "result", ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "生成失败，请稍后再试。";
        console.error("[vibelive:generate] failed", error);
        send({ type: "error", error: message });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      console.info("[vibelive:generate] client disconnected", { prompt });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
