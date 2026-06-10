// 一个 vibe 的完整声音与页面 = 一个可序列化对象。
// 这是分享链接、preset 导出、社区、AI 自制与 Strudel WebAudio 演奏的基础。

export type VisualType = "orbs" | "rain" | "particles" | "waves" | "cosmos";
export type VibeSource = "builtin" | "ai";
export type ScaleType = "major" | "minor" | "minorPentatonic" | "majorPentatonic" | "dorian" | "lydian";
export type LayerType = "drums" | "bass" | "pad" | "melody" | "arp";

export interface VibeLayerPattern {
  enabled: boolean;
  density: number;
  swing: number;
  octave?: number;
}

export interface VibePattern {
  /** 根音，例如 C / F# / Bb */
  root: string;
  scale: ScaleType;
  /** 和弦级数，使用罗马数字便于 AI 与合成器共同理解 */
  chords: string[];
  seed: number;
  layers: Record<LayerType, VibeLayerPattern>;
  mini?: {
    drums?: Partial<Record<"kick" | "snare" | "hat" | "percussion", string>>;
    bassline?: string;
    melodyMotif?: string;
    arpPattern?: string;
  };
  /**
   * 受限 Strudel 表达式。播放器会先经过安全校验，再交给 @strudel/webaudio。
   * 不安全或缺失时，会退回由 mini/chords/layers 自动翻译的 Strudel code。
   */
  strudel?: {
    version: 1;
    code: string;
    notes?: string;
  };
}

export interface VibeParams {
  /** 整体能量 / 律动强度 0~1 */
  energy: number;
  /** 音色的温暖度（低=明亮数字感，高=温暖模拟感）0~1 */
  warmth: number;
  /** 空间 / 混响大小 0~1 */
  space: number;
  /** 明亮度 / 高频含量 0~1 */
  brightness: number;
  /** 环境音强度（雨声、风声等）0~1 */
  ambience: number;
  /** 音符密度 / 繁复程度 0~1 */
  density: number;
  /** 速度 BPM */
  tempo: number;
}

export interface VibePalette {
  /** 主强调色 */
  accent: string;
  /** 次强调色 */
  accent2: string;
  /** 背景基调（近黑，带冷暖倾向） */
  base: string;
}

export interface VibeMusicQualityIssue {
  code: string;
  severity: "warn" | "fail";
  message: string;
}

export interface VibeMusicQuality {
  score: number;
  repaired: boolean;
  issues: VibeMusicQualityIssue[];
}

export interface Vibe {
  id: string;
  /** 中文展示名 */
  name: string;
  /** 英文副名 */
  subtitle: string;
  /** 一句诗意的氛围描述 */
  tagline: string;
  /** 卡片上的 emoji / 符号 */
  glyph: string;
  visual: VisualType;
  palette: VibePalette;
  params: VibeParams;
  pattern?: VibePattern;
  /** 本地音乐质量 gate 的结果，用于展示、分享和后续定向再生成 */
  musicQuality?: VibeMusicQuality;
  /** AI 生成的完整 HTML/CSS/JS 视觉页面，运行在 iframe sandbox 中 */
  visualCode?: string;
  source?: VibeSource;
}

export const VIBES: Vibe[] = [
  {
    id: "cyber-night",
    name: "深夜写代码",
    subtitle: "Cyber Night",
    tagline: "霓虹在窗外溶解，只剩光标与心跳同频。",
    glyph: "◆",
    visual: "orbs",
    palette: { accent: "#ff2e9a", accent2: "#22d3ee", base: "#0a0810" },
    params: {
      energy: 0.62,
      warmth: 0.3,
      space: 0.55,
      brightness: 0.7,
      ambience: 0.2,
      density: 0.5,
      tempo: 92,
    },
    pattern: {
      root: "C",
      scale: "minorPentatonic",
      chords: ["i", "VI", "III", "VII"],
      seed: 4102,
      layers: {
        drums: { enabled: true, density: 0.62, swing: 0.12 },
        bass: { enabled: true, density: 0.48, swing: 0.08, octave: 2 },
        pad: { enabled: true, density: 0.35, swing: 0.04, octave: 4 },
        melody: { enabled: true, density: 0.4, swing: 0.1, octave: 5 },
        arp: { enabled: true, density: 0.45, swing: 0.06, octave: 4 },
      },
      mini: {
        drums: {
          kick: "x---x---x---x---",
          snare: "----x-------x---",
          hat: "x-x-x-x-x-x-x-x-",
        },
        bassline: "0---0---4---3---",
        melodyMotif: "0-2-4---2---0---",
        arpPattern: "02420242--------",
      },
    },
    source: "builtin",
  },
  {
    id: "rainy-lofi",
    name: "雨天阅读",
    subtitle: "Rainy Lo-fi",
    tagline: "雨打窗沿，磁带轻转，时间慢成一杯温茶。",
    glyph: "❍",
    visual: "rain",
    palette: { accent: "#5eead4", accent2: "#6b8cce", base: "#080b10" },
    params: {
      energy: 0.32,
      warmth: 0.78,
      space: 0.7,
      brightness: 0.4,
      ambience: 0.6,
      density: 0.35,
      tempo: 72,
    },
    pattern: {
      root: "F",
      scale: "minorPentatonic",
      chords: ["i", "iv", "VI", "v"],
      seed: 7206,
      layers: {
        drums: { enabled: true, density: 0.32, swing: 0.18 },
        bass: { enabled: true, density: 0.28, swing: 0.16, octave: 2 },
        pad: { enabled: true, density: 0.42, swing: 0.1, octave: 4 },
        melody: { enabled: true, density: 0.22, swing: 0.14, octave: 5 },
        arp: { enabled: false, density: 0.12, swing: 0.08, octave: 4 },
      },
    },
    source: "builtin",
  },
  {
    id: "cyber-meditation",
    name: "赛博冥想",
    subtitle: "Cyber Meditation",
    tagline: "意识漂进数据之海，呼吸被拉得很长很长。",
    glyph: "✺",
    visual: "waves",
    palette: { accent: "#a78bfa", accent2: "#e879f9", base: "#0a0712" },
    params: {
      energy: 0.22,
      warmth: 0.55,
      space: 0.92,
      brightness: 0.5,
      ambience: 0.4,
      density: 0.2,
      tempo: 58,
    },
    pattern: {
      root: "D",
      scale: "dorian",
      chords: ["i", "IV", "i", "VII"],
      seed: 5809,
      layers: {
        drums: { enabled: false, density: 0.08, swing: 0.02 },
        bass: { enabled: true, density: 0.18, swing: 0.04, octave: 2 },
        pad: { enabled: true, density: 0.68, swing: 0.02, octave: 4 },
        melody: { enabled: true, density: 0.16, swing: 0.04, octave: 5 },
        arp: { enabled: true, density: 0.18, swing: 0.03, octave: 4 },
      },
    },
    source: "builtin",
  },
  {
    id: "deep-focus",
    name: "低保真学习",
    subtitle: "Deep Focus",
    tagline: "暖黄台灯下，思绪沿着稳定的节拍一行行落地。",
    glyph: "▲",
    visual: "particles",
    palette: { accent: "#fbbf24", accent2: "#f97316", base: "#0d0a07" },
    params: {
      energy: 0.45,
      warmth: 0.85,
      space: 0.45,
      brightness: 0.55,
      ambience: 0.3,
      density: 0.5,
      tempo: 80,
    },
    pattern: {
      root: "A",
      scale: "minorPentatonic",
      chords: ["i", "VII", "VI", "VII"],
      seed: 8011,
      layers: {
        drums: { enabled: true, density: 0.42, swing: 0.15 },
        bass: { enabled: true, density: 0.36, swing: 0.1, octave: 2 },
        pad: { enabled: true, density: 0.34, swing: 0.06, octave: 4 },
        melody: { enabled: true, density: 0.28, swing: 0.08, octave: 5 },
        arp: { enabled: false, density: 0.18, swing: 0.05, octave: 4 },
      },
    },
    source: "builtin",
  },
  {
    id: "forest-walk",
    name: "森林散步",
    subtitle: "Forest Walk",
    tagline: "苔藓、湿土与远处鸟鸣，脚步踩在松软的光里。",
    glyph: "✦",
    visual: "particles",
    palette: { accent: "#4ade80", accent2: "#a3e635", base: "#070d09" },
    params: {
      energy: 0.4,
      warmth: 0.7,
      space: 0.6,
      brightness: 0.6,
      ambience: 0.7,
      density: 0.4,
      tempo: 76,
    },
    pattern: {
      root: "G",
      scale: "majorPentatonic",
      chords: ["I", "V", "vi", "IV"],
      seed: 7617,
      layers: {
        drums: { enabled: true, density: 0.24, swing: 0.08 },
        bass: { enabled: true, density: 0.3, swing: 0.05, octave: 2 },
        pad: { enabled: true, density: 0.46, swing: 0.04, octave: 4 },
        melody: { enabled: true, density: 0.32, swing: 0.05, octave: 5 },
        arp: { enabled: true, density: 0.2, swing: 0.04, octave: 4 },
      },
    },
    source: "builtin",
  },
  {
    id: "cosmic-drift",
    name: "宇宙漂浮",
    subtitle: "Cosmic Drift",
    tagline: "失重，无声，在星云之间被温柔地推向更远处。",
    glyph: "✷",
    visual: "cosmos",
    palette: { accent: "#60a5fa", accent2: "#818cf8", base: "#06070f" },
    params: {
      energy: 0.18,
      warmth: 0.4,
      space: 1.0,
      brightness: 0.45,
      ambience: 0.5,
      density: 0.25,
      tempo: 50,
    },
    pattern: {
      root: "E",
      scale: "lydian",
      chords: ["I", "II", "V", "I"],
      seed: 5023,
      layers: {
        drums: { enabled: false, density: 0.06, swing: 0.01 },
        bass: { enabled: true, density: 0.12, swing: 0.02, octave: 2 },
        pad: { enabled: true, density: 0.78, swing: 0.01, octave: 4 },
        melody: { enabled: true, density: 0.14, swing: 0.02, octave: 5 },
        arp: { enabled: true, density: 0.12, swing: 0.02, octave: 4 },
      },
    },
    source: "builtin",
  },
];

export const PARAM_META: { key: keyof VibeParams; label: string; min: number; max: number; unit?: string }[] = [
  { key: "energy", label: "能量", min: 0, max: 1 },
  { key: "warmth", label: "温暖", min: 0, max: 1 },
  { key: "space", label: "空间", min: 0, max: 1 },
  { key: "brightness", label: "明亮", min: 0, max: 1 },
  { key: "ambience", label: "环境音", min: 0, max: 1 },
  { key: "density", label: "密度", min: 0, max: 1 },
  { key: "tempo", label: "速度", min: 40, max: 140, unit: "BPM" },
];

export function getVibe(id: string): Vibe | undefined {
  return VIBES.find((v) => v.id === id);
}
