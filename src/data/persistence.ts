import type { Vibe } from "./vibes";
import { normalizeGeneratedVibe } from "@/ai/schema";

const STORAGE_KEY = "vibelive:saved-vibes";

function toBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64(value: string) {
  return decodeURIComponent(escape(atob(value)));
}

export function encodeVibeForHash(vibe: Vibe) {
  // 视觉代码可能很大，分享链接默认保留结构化参数与 pattern，必要时可重新生成视觉。
  const compact: Vibe = { ...vibe, visualCode: undefined };
  return toBase64(JSON.stringify(compact));
}

export function decodeVibeFromHash(hash: string): Vibe | null {
  const match = hash.match(/vibe=([^&]+)/);
  if (!match) return null;

  try {
    return normalizeGeneratedVibe(JSON.parse(fromBase64(decodeURIComponent(match[1]))));
  } catch {
    return null;
  }
}

export function loadSavedVibes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      try {
        return [normalizeGeneratedVibe(item)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveVibeToLibrary(vibe: Vibe) {
  const current = loadSavedVibes();
  const next = [vibe, ...current.filter((item) => item.id !== vibe.id)].slice(0, 24);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeSavedVibeFromLibrary(id: string) {
  const next = loadSavedVibes().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
