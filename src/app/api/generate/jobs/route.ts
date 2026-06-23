import { createGenerationJob } from "@/ai/generationJobs";
import { sanitizeUserAiConfig } from "@/ai/userConfig";

export const runtime = "nodejs";
export const maxDuration = 120;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const buckets = new Map<string, { count: number; resetAt: number }>();

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

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "不允许的请求来源。" }, { status: 403 });
  }

  if (!consumeRateLimit(getClientKey(request))) {
    return Response.json({ error: "生成太频繁了，请稍后再试。" }, { status: 429 });
  }

  const body = (await request.json()) as { prompt?: unknown; aiConfig?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (prompt.length < 3) {
    return Response.json({ error: "请至少描述 3 个字符的氛围。" }, { status: 400 });
  }

  if (prompt.length > 600) {
    return Response.json({ error: "描述太长了，请控制在 600 字以内。" }, { status: 400 });
  }

  return Response.json({ job: createGenerationJob(prompt, { aiConfig: sanitizeUserAiConfig(body.aiConfig) }) });
}
