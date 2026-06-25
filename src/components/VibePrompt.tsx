"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateArtworkForVibe } from "@/ai/artwork";
import { generateVibeFromPrompt, regenerateVibeFromPrompt, type GenerationStage } from "@/ai/generate";
import { hasUsableImageToolConfig, hasUsableUserAiConfig, type UserAiConfig, type UserImageToolConfig } from "@/ai/userConfig";
import type { RegenerateTarget } from "@/data/regeneration";
import type { Vibe } from "@/data/vibes";

interface Props {
  onGenerated: (vibe: Vibe, prompt: string, phase?: "music" | "artwork") => void;
  onOpenVibe?: (vibe: Vibe) => void;
  baseVibe?: Vibe | null;
  accent?: string;
  accent2?: string;
  aiConfig?: Partial<UserAiConfig>;
  onGeneratingChange?: (generating: boolean) => void;
  onNewSession?: () => void;
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

type GenerateStreamEvent =
  | { type: "log"; message?: string }
  | { type: "stage"; stage?: GenerationStage }
  | (GenerateResponse & { type: "result" })
  | { type: "error"; error?: string; detail?: string };

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
const CLIENT_ONLY_GENERATION = process.env.NEXT_PUBLIC_VIBELIVE_CLIENT_ONLY === "1";

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

function shouldUseClientGeneration() {
  if (CLIENT_ONLY_GENERATION) return true;
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:" || window.location.protocol === "app:";
}

function toImageRequestConfig(config: UserImageToolConfig) {
  return {
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
  };
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

function stageStatusLabel(status: GenerationStage["status"]) {
  if (status === "completed") return "完成";
  if (status === "repaired") return "修复";
  if (status === "fallback") return "备用";
  if (status === "error") return "失败";
  return "进行中";
}

function buildStreamMessage(headline: string, stages: GenerationStage[]) {
  const lines = stages
    .slice(-7)
    .map((stage) => `${stageStatusLabel(stage.status)} · ${stage.label}`)
    .join("\n");
  return lines ? `${headline}\n${lines}` : headline;
}

async function readGenerationStream(
  response: Response,
  onEvent: (event: GenerateStreamEvent) => void,
): Promise<GenerateResponse> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as GenerateResponse;
    throw new Error(payload.error || payload.detail || "生成失败，请稍后再试。");
  }

  if (!response.body) {
    const payload = (await response.json()) as GenerateResponse;
    if (!payload.vibe) throw new Error(payload.error || payload.detail || "生成失败，请稍后再试。");
    return payload;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: GenerateResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = JSON.parse(trimmed) as GenerateStreamEvent;
        onEvent(event);
        if (event.type === "error") {
          throw new Error(event.error || event.detail || "生成失败，请稍后再试。");
        }
        if (event.type === "result") {
          result = event;
        }
      }
    }
    if (done) break;
  }

  if (!result?.vibe) throw new Error(result?.error || result?.detail || "生成失败，请稍后再试。");
  return result;
}

export default function VibePrompt({
  onGenerated,
  onOpenVibe,
  baseVibe,
  accent,
  accent2,
  aiConfig,
  onGeneratingChange,
  onNewSession,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState(EXAMPLES[0]);
  const [generating, setGenerating] = useState(false);
  const [useArtworkTool, setUseArtworkTool] = useState(true);
  const [latestVibe, setLatestVibe] = useState<Vibe | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageToolReady = hasUsableImageToolConfig(aiConfig);

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
    onGeneratingChange?.(generating);
  }, [generating, onGeneratingChange]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "56px";
    textarea.style.height = `${Math.min(160, Math.max(56, textarea.scrollHeight))}px`;
  }, [inputValue]);

  function startNewSession() {
    if (generating) return;
    setMessages([]);
    setLatestVibe(null);
    setInputValue(EXAMPLES[0]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    onNewSession?.();
  }

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
      const conversationHistory = toConversationHistory(nextHistory, MAX_CONVERSATION_MESSAGES);
      const streamedStages: GenerationStage[] = [];
      const updatePendingText = (text: string, status: ChatMessage["status"] = "thinking") => {
        setMessages((current) =>
          current.map((item) => (item.id === pendingId ? { ...item, text, status } : item)),
        );
      };
      const handleStage = (stage: GenerationStage) => {
        streamedStages.push(stage);
        updatePendingText(buildStreamMessage("正在刻录，实时监听 agent 步骤...", streamedStages));
      };
      let data: GenerateResponse;

      if (shouldUseClientGeneration()) {
        if (!requestAiConfig) {
          throw new Error("AI 配置未完成，请先填写 API Key、Base URL 与 Model。");
        }

        data =
          baseVibe && target
            ? await regenerateVibeFromPrompt(value, baseVibe, target, {
                conversationHistory,
                maxConversationMessages: MAX_CONVERSATION_MESSAGES,
                aiConfig: requestAiConfig,
                onStage: handleStage,
              })
            : await generateVibeFromPrompt(value, {
                conversationHistory,
                maxConversationMessages: MAX_CONVERSATION_MESSAGES,
                aiConfig: requestAiConfig,
                onStage: handleStage,
              });
      } else {
        const response = await fetch("/api/generate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: value,
            conversationHistory,
            maxConversationMessages: MAX_CONVERSATION_MESSAGES,
            aiConfig: requestAiConfig,
            baseVibe,
            regenerateTarget: target,
          }),
        });
        data = await readGenerationStream(response, (event) => {
          if (event.type === "log" && event.message) {
            updatePendingText(event.message);
          }
          if (event.type === "stage" && event.stage) {
            handleStage(event.stage);
          }
        });
      }

      if (!data.vibe) {
        throw new Error(data.error || data.detail || "生成失败，请稍后再试。");
      }

      let finalVibe = data.vibe;
      let artworkWarning = "";

      if (imageToolReady && useArtworkTool && aiConfig?.imageTool) {
        updatePendingText("编曲完成，正在调用背景图工具...");

        try {
          const imageConfig = toImageRequestConfig(aiConfig.imageTool);
          const artwork = shouldUseClientGeneration()
            ? await generateArtworkForVibe(finalVibe, value, imageConfig)
            : await fetch("/api/artwork", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: value,
                  vibe: finalVibe,
                  aiConfig: imageConfig,
                }),
              }).then(async (response) => {
                const payload = (await response.json().catch(() => ({}))) as {
                  artwork?: Vibe["artwork"];
                  error?: string;
                  detail?: string;
                };
                if (!response.ok || !payload.artwork) {
                  throw new Error(payload.error || payload.detail || "背景图生成失败。");
                }
                return payload.artwork;
              });

          finalVibe = { ...finalVibe, artwork };
        } catch (error) {
          artworkWarning = error instanceof Error ? error.message : "背景图生成失败，已保留纯色背景。";
        }
      }

      setLatestVibe(finalVibe);
      onGenerated(finalVibe, value, finalVibe.artwork ? "artwork" : "music");
      const doneText = artworkWarning
        ? `已完成音乐。${artworkWarning}`
        : finalVibe.artwork
          ? "已完成音乐和背景图。点这张唱片进入播放器，或继续告诉我怎么改。"
          : data.fallback
            ? "已先完成一版，可以试听这张唱片。"
            : "已完成。点这张唱片进入播放器，或继续告诉我怎么改。";
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                text: streamedStages.length ? buildStreamMessage(doneText, streamedStages) : doneText,
                status: "done",
                vibe: finalVibe,
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
        <div className="vibe-dialog__session">
          <button type="button" onClick={startNewSession} disabled={generating}>
            新会话
          </button>
          <span className="vibe-dialog__context">{contextLabel}</span>
        </div>
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

      {imageToolReady && (
        <button
          type="button"
          className={`vibe-dialog__tool-toggle ${useArtworkTool ? "is-active" : ""}`}
          aria-pressed={useArtworkTool}
          onClick={() => setUseArtworkTool((value) => !value)}
          disabled={generating}
        >
          <span aria-hidden="true" />
          {useArtworkTool ? "生成背景图" : "纯色背景"}
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
