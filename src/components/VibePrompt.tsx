"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Vibe } from "@/data/vibes";

interface Props {
  onGenerated: (vibe: Vibe, prompt: string) => void;
  accent?: string;
  accent2?: string;
}

type RecorderStatus = "idle" | "generating" | "completed" | "error";
type LogStatus = "pending" | "completed" | "repaired" | "fallback" | "error";

interface RecorderLog {
  id: string;
  label: string;
  status: LogStatus;
  at: string;
  message?: string;
}

interface RecorderSession {
  id: string;
  prompt: string;
  status: RecorderStatus;
  logs: RecorderLog[];
  startedAt: string;
  updatedAt: string;
  error?: string;
  vibe?: Vibe;
}

interface StreamEvent {
  type?: string;
  at?: string;
  message?: string;
  error?: string;
  stage?: {
    id: string;
    label: string;
    status: "completed" | "repaired" | "fallback";
  };
  vibe?: Vibe;
}

const STORAGE_KEY = "vibelive:recorder-session:v1";
const EXAMPLES = ["雨夜便利店门口的低保真爵士", "漂浮在木星云层里的冥想电子", "凌晨三点写代码的霓虹鼓点"];

function createSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function loadStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecorderSession;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.logs)) return null;
    if (parsed.status === "generating") {
      return {
        ...parsed,
        status: "error" as RecorderStatus,
        error: "页面刷新后无法继续接收上一次刻录日志，请重新刻录。",
        updatedAt: nowIso(),
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "--:--:--";
  }
}

function persistSession(session: RecorderSession | null) {
  if (typeof window === "undefined" || !session) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export default function VibePrompt({ onGenerated, accent, accent2 }: Props) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<RecorderSession | null>(null);
  const generating = session?.status === "generating";

  const statusText = useMemo(() => {
    if (!session) return "等待刻录";
    if (session.status === "generating") return "刻录中";
    if (session.status === "completed") return "刻录完成";
    if (session.status === "error") return "刻录中断";
    return "等待刻录";
  }, [session]);

  useEffect(() => {
    queueMicrotask(() => {
      setSession(loadStoredSession());
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined" || !session) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  function updateSession(updater: (current: RecorderSession) => RecorderSession) {
    setSession((current) => {
      const next = current ? updater(current) : current;
      persistSession(next);
      return next;
    });
  }

  function replaceSession(next: RecorderSession) {
    persistSession(next);
    setSession(next);
  }

  function appendLog(log: Omit<RecorderLog, "at"> & { at?: string }) {
    updateSession((current) => ({
      ...current,
      logs: [...current.logs, { ...log, at: log.at ?? nowIso() }],
      updatedAt: nowIso(),
    }));
  }

  function handleStreamEvent(event: StreamEvent) {
    const at = event.at ?? nowIso();

    if (event.type === "log") {
      appendLog({
        id: `log-${at}`,
        label: event.message ?? "刻录日志",
        status: "completed",
        at,
      });
      return;
    }

    if (event.type === "stage" && event.stage) {
      appendLog({
        id: event.stage.id,
        label: event.stage.label,
        status: event.stage.status,
        at,
      });
      return;
    }

    if (event.type === "error") {
      updateSession((current) => ({
        ...current,
        status: "error",
        error: event.error ?? "生成失败，请稍后再试。",
        logs: [
          ...current.logs,
          {
            id: "error",
            label: "刻录失败",
            status: "error",
            at,
            message: event.error,
          },
        ],
        updatedAt: nowIso(),
      }));
    }
  }

  async function generate() {
    const value = prompt.trim();
    if (value.length < 3) {
      const at = nowIso();
      replaceSession({
        id: createSessionId(),
        prompt: value,
        status: "error",
        logs: [{ id: "validation", label: "请先描述一个更具体的氛围", status: "error", at }],
        startedAt: at,
        updatedAt: at,
        error: "请先描述一个更具体的氛围。",
      });
      return;
    }

    const startedAt = nowIso();
    replaceSession({
      id: createSessionId(),
      prompt: value,
      status: "generating",
      logs: [{ id: "start", label: "准备空白唱片", status: "pending", at: startedAt }],
      startedAt,
      updatedAt: startedAt,
    });

    try {
      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(data.error || data.detail || "刻录请求失败。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          handleStreamEvent(event);

          if (event.type === "result" && event.vibe) {
            const completedAt = event.at ?? nowIso();
            updateSession((current) => ({
              ...current,
              status: "completed",
              vibe: event.vibe,
              logs: [
                ...current.logs,
                {
                  id: "done",
                  label: "唱片刻录完成",
                  status: "completed",
                  at: completedAt,
                },
              ],
              updatedAt: completedAt,
            }));
            onGenerated(event.vibe, value);
            setOpen(false);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败，请稍后再试。";
      const at = nowIso();
      updateSession((current) => ({
        ...current,
        status: "error",
        error: message,
        logs: [...current.logs, { id: "error", label: "刻录失败", status: "error", at, message }],
        updatedAt: at,
      }));
    }
  }

  const recorderDialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="vibe-recorder"
            role="dialog"
            aria-modal="true"
            aria-label="刻录新氛围"
            style={{
              ["--accent" as string]: accent,
              ["--accent-2" as string]: accent2,
              ["--scene-accent" as string]: accent,
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div className="vibe-recorder__panel">
              <button type="button" className="vibe-recorder__close" aria-label="关闭" onClick={() => setOpen(false)}>
                ×
              </button>

              <div className={`vibe-recorder__record ${generating ? "is-cutting" : ""}`} aria-hidden="true">
                <span className="vibe-recorder__label">REC</span>
              </div>

              <div className="vibe-recorder__form">
                <span className="vibe-recorder__kicker mono">PRIVATE PRESSING</span>
                <h2>写一句，刻成声音</h2>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="雨夜便利店门口的低保真爵士"
                  maxLength={600}
                  autoFocus
                  disabled={generating}
                />

                <div className="vibe-recorder__examples" aria-label="示例提示词">
                  {EXAMPLES.map((example) => (
                    <button key={example} type="button" onClick={() => setPrompt(example)} disabled={generating}>
                      {example}
                    </button>
                  ))}
                </div>

                <div className="vibe-recorder__status" aria-live="polite">
                  <span className="mono">{statusText}</span>
                  {session && <small>{session.prompt}</small>}
                </div>

                {session?.logs.length ? (
                  <div className="vibe-recorder__logs">
                    {session.logs.map((log, index) => (
                      <div key={`${log.id}-${log.at}-${index}`} className={`vibe-recorder__log is-${log.status}`}>
                        <span className="mono">{formatTime(log.at)}</span>
                        <strong>{log.label}</strong>
                        {log.message && <small>{log.message}</small>}
                      </div>
                    ))}
                  </div>
                ) : null}

                {session?.error && <p className="vibe-prompt__error">{session.error}</p>}

                <button className="vibe-recorder__submit" type="button" onClick={generate} disabled={generating}>
                  {generating ? "刻录中..." : "开始刻录"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" className="blank-record-slot" onClick={() => setOpen(true)}>
        <span className="blank-record-slot__sleeve" aria-hidden="true">
          <span className="blank-record-slot__disc" />
        </span>
        <span className="blank-record-slot__copy">
          <span className="blank-record-slot__kicker mono">BLANK CUT</span>
          <strong>{generating ? "正在刻录" : "刻一张新唱片"}</strong>
          <small>{session ? `${statusText} · ${session.logs.length} 条日志` : "写下场景，开始刻录"}</small>
        </span>
      </button>
      {recorderDialog}
    </>
  );
}
