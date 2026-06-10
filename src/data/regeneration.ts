export type RegenerateTarget = "music" | "drums" | "bass" | "pad" | "melody" | "arp" | "visual" | "full";
export type MusicFeedbackKey = "too-dark" | "too-noisy" | "weak-melody" | "not-matching" | "too-empty" | "too-busy";

export const REGENERATE_TARGETS: RegenerateTarget[] = ["music", "drums", "bass", "pad", "melody", "arp", "visual", "full"];

export const PLAYER_REGENERATE_OPTIONS: { target: RegenerateTarget; label: string }[] = [
  { target: "music", label: "整首" },
  { target: "drums", label: "鼓" },
  { target: "bass", label: "低音" },
  { target: "melody", label: "旋律" },
  { target: "arp", label: "琶音" },
  { target: "visual", label: "视觉" },
];

export interface MusicFeedbackOption {
  key: MusicFeedbackKey;
  label: string;
  target: RegenerateTarget;
  prompt: string;
}

export const MUSIC_FEEDBACK_OPTIONS: MusicFeedbackOption[] = [
  {
    key: "too-dark",
    label: "太暗",
    target: "music",
    prompt:
      "用户反馈：当前音乐太暗、太冷或太忧郁。请重新创作得更明亮、更轻盈，提升 brightness 和前景旋律，降低低频 drone、过厚 pad、过高 ambience。",
  },
  {
    key: "too-noisy",
    label: "太吵",
    target: "pad",
    prompt:
      "用户反馈：当前音乐太吵、太糊或背景嗡嗡声太重。请降低 ambience、space 和 pad density，减少高频杂乱层，让鼓、低音、旋律分层更清楚。",
  },
  {
    key: "weak-melody",
    label: "旋律弱",
    target: "melody",
    prompt:
      "用户反馈：当前音乐缺少可记忆的旋律。请重点重写 melodyMotif 和原生 strudel.code，让前景 motif 更清楚、有重复感、有场景辨识度。",
  },
  {
    key: "not-matching",
    label: "不贴合",
    target: "music",
    prompt:
      "用户反馈：当前音乐和用户想象场景不匹配。请重新判断场景季节、明暗、空间和情绪，重写 chords、mini 与 strudel.code，优先场景匹配而不是通用 lo-fi。",
  },
  {
    key: "too-empty",
    label: "太空",
    target: "arp",
    prompt:
      "用户反馈：当前音乐太空、太少、缺少推进。请增加适量 arp 或细碎装饰音，保留留白但让循环更有生命力，不要堆满所有层。",
  },
  {
    key: "too-busy",
    label: "太满",
    target: "music",
    prompt:
      "用户反馈：当前音乐层次太满、音符太密。请减少同时触发的层，给鼓、低音、旋律留空间，降低 density，但保留一个清楚的前景动机。",
  },
];
