"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasUsableUserAiConfig, type UserAiConfig } from "@/ai/userConfig";
import type { RegenerateTarget } from "@/data/regeneration";
import type { Vibe } from "@/data/vibes";

interface Props {
  onGenerated: (vibe: Vibe, prompt: string, phase?: "music" | "artwork") => void;
  onOpenVibe?: (vibe: Vibe) => void;
  baseVibe?: Vibe | null;
  accent?: string;
  accent2?: string;
  aiConfig?: Partial<UserAiConfig>;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "thinking" | "done" | "error";
  vibe?: Vibe;
};

interface GenerateResponse {
  vibe?: Vibe;
  error?: string;
  detail?: string;
  fallback?: boolean;
}

type ConversationPayloadTurn = {
  role: "user" | "assistant";
  text: string;
};

const STORAGE_KEY = "vibelive:conversation:v2";
const EXAMPLES = ["更像森林里的旧收音机", "把节奏放慢，留出更多空气", "换成极简深绿色网页，只保留轻微漂浮动画"];
const DEFAULT_MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONVERSATION_MESSAGES_CAP = 20;
const MAX_CONVERSATION_MESSAGES = getClientMaxConversationMessages();
const MESSAGE_STORAGE_LIMIT = Math.max(6, MAX_CONVERSATION_MESSAGES + 2);

function createId(prefix = "msg") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MESSAGE_STORAGE_LIMIT);
  } catch {
    return [];
  }
}

function getClientMaxConversationMessages() {
  const raw = process.env.NEXT_PUBLIC_VIBELIVE_MAX_CONVERSATION_MESSAGES;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_CONVERSATION_MESSAGES;
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CONVERSATION_MESSAGES;
  return Math.max(0, Math.min(MAX_CONVERSATION_MESSAGES_CAP, parsed));
}

function inferTarget(prompt: string): RegenerateTarget {
  if (/网页|页面|视觉|背景|颜色|动画|封面|画面|极简|高级感|氛围感/.test(prompt)) return "visual";
  if (/鼓|鼓点|节拍|kick|snare|hat/i.test(prompt)) return "drums";
  if (/低音|bass/i.test(prompt)) return "bass";
  if (/旋律|melody|主线/i.test(prompt)) return "melody";
  if (/琶音|arp/i.test(prompt)) return "arp";
  if (/整体|整张|全部|重做|重新/i.test(prompt)) return "full";
  return "music";
}

function toConversationHistory(messages: ChatMessage[], maxMessages: number): ConversationPayloadTurn[] {
  if (maxMessages <= 0) return [];

  return messages
    .filter((message) => message.status !== "thinking" && (message.role === "user" || message.role === "assistant") && message.text.trim())
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      text: message.text.trim().replace(/\s+/g, " ").slice(0, 600),
    }));
}

export default function VibePrompt({ onGenerated, onOpenVibe, baseVibe, accent, accent2, aiConfig }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState(EXAMPLES[0]);
  const [generating, setGenerating] = useState(false);
  const [latestVibe, setLatestVibe] = useState<Vibe | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contextLabel = baseVibe ? `正在修改「${baseVibe.name}」` : "新建唱片";
  const targetLabel = useMemo(() => {
    if (!baseVibe) return "新唱片";
    return inferTarget(inputValue) === "visual" ? "视觉调音" : "音乐调音";
  }, [baseVibe, inputValue]);

  useEffect(() => {
    queueMicrotask(() => setMessages(loadStoredMessages()));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MESSAGE_STORAGE_LIMIT)));
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "56px";
    textarea.style.height = `${Math.min(160, Math.max(56, textarea.scrollHeight))}px`;
  }, [inputValue]);

  async function submit() {
    const value = inputValue.trim();
    if (value.length < 3 || generating) return;

    const userMessage: ChatMessage = { id: createId("user"), role: "user", text: value };
    const pendingId = createId("assistant");
    const nextHistory = [...messages, userMessage];
    setMessages((current) => [
      ...current.slice(-(MESSAGE_STORAGE_LIMIT - 2)),
      userMessage,
      { id: pendingId, role: "assistant", text: baseVibe ? "正在沿着这张唱片重新取样..." : "正在刻录一张新的唱片...", status: "thinking" },
    ]);
    setInputValue("");
    setGenerating(true);

    try {
      const target = baseVibe ? inferTarget(value) : undefined;
      const requestAiConfig = hasUsableUserAiConfig(aiConfig) ? aiConfig : undefined;
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: value,
          conversationHistory: toConversationHistory(nextHistory, MAX_CONVERSATION_MESSAGES),
          maxConversationMessages: MAX_CONVERSATION_MESSAGES,
          aiConfig: requestAiConfig,
          baseVibe,
          regenerateTarget: target,
        }),
      });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.vibe) {
        throw new Error(data.error || data.detail || "生成失败，请稍后再试。");
      }

      setLatestVibe(data.vibe);
      onGenerated(data.vibe, value, target === "visual" ? "artwork" : "music");
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                text: data.fallback ? "已先完成一版，可以试听这张唱片。" : "已完成。点这张唱片进入播放器，或继续告诉我怎么改。",
                status: "done",
                vibe: data.vibe,
              }
            : message,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败，请稍后再试。";
      setMessages((current) =>
        current.map((item) => (item.id === pendingId ? { ...item, text: message, status: "error" } : item)),
      );
    } finally {
      setGenerating(false);
    }
  }

  const displayMessages =
    messages.length > 0
      ? messages
      : [
          {
            id: "intro",
            role: "assistant" as const,
            text: "告诉我一个场景，或在打开一张唱片后回到这里继续修改它。",
            status: "done" as const,
          },
        ];

  return (
    <section
      className={`vibe-dialog ${generating ? "is-thinking" : ""}`}
      style={{
        ["--accent" as string]: accent,
        ["--accent-2" as string]: accent2,
      }}
      aria-label="氛围对话框"
    >
      <div className="vibe-dialog__head">
        <div>
          <span className="vibe-dialog__kicker mono">{targetLabel}</span>
          <h2>氛围手札</h2>
        </div>
        <span className="vibe-dialog__context">{contextLabel}</span>
      </div>

      <div className="vibe-dialog__messages" aria-live="polite">
        {displayMessages.map((message) => (
          <article key={message.id} className={`vibe-dialog__message is-${message.role} ${message.status ? `is-${message.status}` : ""}`}>
            <p>{message.text}</p>
            {message.vibe && (
              <button type="button" className="vibe-dialog__result" onClick={() => onOpenVibe?.(message.vibe!)}>
                <span aria-hidden="true">{message.vibe.glyph}</span>
                <strong>{message.vibe.name}</strong>
                <small className="mono">{message.vibe.subtitle}</small>
              </button>
            )}
          </article>
        ))}
      </div>

      {(latestVibe || baseVibe) && (
        <button type="button" className="vibe-dialog__record" onClick={() => onOpenVibe?.(latestVibe ?? baseVibe!)}>
          <span className="vibe-dialog__record-disc" aria-hidden="true" />
          <span>
            <strong>{(latestVibe ?? baseVibe)?.name}</strong>
            <small>{latestVibe ? "最新结果，可进入播放器" : "当前修改对象"}</small>
          </span>
        </button>
      )}

      <div className="vibe-dialog__examples" aria-label="示例提示词">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" onClick={() => setInputValue(example)} disabled={generating}>
            {example}
          </button>
        ))}
      </div>

      <div className="vibe-dialog__composer">
        <button
          type="button"
          className={`voice-button ${generating ? "is-listening" : ""}`}
          aria-label="语音输入动效"
          onClick={() => setInputValue((value) => value || "把它改得更安静一点")}
        >
          <span />
        </button>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={generating}
          placeholder="输入一句场景，或继续说怎么修改这张唱片"
          maxLength={600}
        />
        <button type="button" className="vibe-dialog__send" onClick={() => void submit()} disabled={generating || inputValue.trim().length < 3}>
          {generating ? <span className="vibe-dialog__spinner" aria-hidden="true" /> : "写入"}
        </button>
      </div>
    </section>
  );
}
