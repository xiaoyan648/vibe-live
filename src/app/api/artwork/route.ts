import { NextResponse } from "next/server";
import { generateArtworkForVibe } from "@/ai/artwork";
import { sanitizeUserAiConfig } from "@/ai/userConfig";
import type { Vibe } from "@/data/vibes";

export const runtime = "nodejs";
export const maxDuration = 120;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 4;
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

function sanitizeVibe(input: unknown): Partial<Vibe> | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Partial<Vibe>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const tagline = typeof source.tagline === "string" ? source.tagline.trim() : "";
  if (!name && !tagline) return null;

  return {
    id: typeof source.id === "string" ? source.id : undefined,
    name,
    subtitle: typeof source.subtitle === "string" ? source.subtitle : undefined,
    tagline,
    glyph: typeof source.glyph === "string" ? source.glyph : undefined,
    visual: source.visual,
    palette: source.palette,
    params: source.params,
  };
}

function isProviderAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("401") || message.includes("Unauthorized") || message.includes("auth.unauthorized");
}

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: "不允许的请求来源。" }, { status: 403 });
    }

    if (!consumeRateLimit(getClientKey(request))) {
      return NextResponse.json({ error: "封面生成太频繁了，请稍后再试。" }, { status: 429 });
    }

    const body = (await request.json()) as { prompt?: unknown; vibe?: unknown; aiConfig?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const vibe = sanitizeVibe(body.vibe);

    if (!vibe) {
      return NextResponse.json({ error: "缺少可用于生成封面的氛围信息。" }, { status: 400 });
    }

    if (prompt.length > 600) {
      return NextResponse.json({ error: "描述太长了，请控制在 600 字以内。" }, { status: 400 });
    }

    const artwork = await generateArtworkForVibe(vibe, prompt || vibe.tagline || vibe.name || "", sanitizeUserAiConfig(body.aiConfig));
    return NextResponse.json({ artwork });
  } catch (error) {
    const message = error instanceof Error ? error.message : "封面生成失败";
    const missingEnv = message.includes("Missing OPENAI_API_KEY") || message.includes("Missing ARK_API_KEY");

    return NextResponse.json(
      {
        error: missingEnv
          ? "图片生成配置未完成，请检查本地 AI 配置，或开发环境的 OPENAI_* / ARK_* 变量。"
          : isProviderAuthError(error)
            ? "图片生成鉴权失败，请检查本地 API Key 或开发环境 key。"
            : "封面生成暂时失败，已保留音乐刻录结果。",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: missingEnv ? 500 : 502 },
    );
  }
}
