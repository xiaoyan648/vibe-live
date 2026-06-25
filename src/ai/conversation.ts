export type ConversationRole = "user" | "assistant";

export interface ConversationTurn {
  role: ConversationRole;
  text: string;
}

const DEFAULT_MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONVERSATION_MESSAGES_CAP = 20;
const MAX_TURN_CHARS = 600;
const MAX_CONTEXT_CHARS = 2200;

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseConversationLimit(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampInteger(value, 0, MAX_CONVERSATION_MESSAGES_CAP);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clampInteger(parsed, 0, MAX_CONVERSATION_MESSAGES_CAP);
    }
  }

  return undefined;
}

function readEnv(name: string) {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

export function getMaxConversationMessages(requested?: unknown) {
  return (
    parseConversationLimit(requested) ??
    parseConversationLimit(readEnv("VIBELIVE_MAX_CONVERSATION_MESSAGES")) ??
    parseConversationLimit(readEnv("NEXT_PUBLIC_VIBELIVE_MAX_CONVERSATION_MESSAGES")) ??
    DEFAULT_MAX_CONVERSATION_MESSAGES
  );
}

function compactTurnText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TURN_CHARS) : "";
}

export function normalizeConversationHistory(input: unknown, maxMessages = getMaxConversationMessages()): ConversationTurn[] {
  if (!Array.isArray(input) || maxMessages <= 0) return [];

  const turns: ConversationTurn[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : undefined;
    const text = compactTurnText(record.text);
    if (!role || !text) continue;
    turns.push({ role, text });
  }

  return turns.slice(-maxMessages);
}

export function buildPromptWithConversation(prompt: string, history: ConversationTurn[]) {
  const currentPrompt = compactTurnText(prompt);
  const dedupedHistory =
    history.at(-1)?.role === "user" && history.at(-1)?.text === currentPrompt ? history.slice(0, -1) : history;

  const lines = dedupedHistory.map((turn) => `${turn.role === "user" ? "用户" : "助手"}：${turn.text}`);
  const context = lines.length ? `最近对话（旧到新）：\n${lines.join("\n")}\n\n` : "";

  return `${context}本轮要求：${currentPrompt}`.slice(0, MAX_CONTEXT_CHARS);
}
