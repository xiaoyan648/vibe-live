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

export interface VibeArtwork {
  imageUrl: string;
  prompt: string;
  model: string;
  createdAt: string;
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
  /** AI 生成的统一视觉母图，用作背景、唱片封面和播放器中心画面 */
  artwork?: VibeArtwork;
  source?: VibeSource;
}

export const VIBES: Vibe[] = [
  {
    id: "cyber-night",
    name: "霓虹午夜",
    subtitle: "Neon Afterhours",
    tagline: "玻璃幕墙还亮着，键盘像一排微小的脉冲灯。",
    glyph: "◆",
    visual: "orbs",
    palette: { accent: "#ff3b8d", accent2: "#32d5ff", base: "#09070f" },
    params: {
      energy: 0.68,
      warmth: 0.28,
      space: 0.5,
      brightness: 0.76,
      ambience: 0.18,
      density: 0.58,
      tempo: 104,
    },
    pattern: {
      root: "C",
      scale: "minorPentatonic",
      chords: ["i", "ivm7", "VImaj7", "VII"],
      seed: 4102,
      layers: {
        drums: { enabled: true, density: 0.7, swing: 0.08 },
        bass: { enabled: true, density: 0.58, swing: 0.05, octave: 2 },
        pad: { enabled: true, density: 0.32, swing: 0.03, octave: 4 },
        melody: { enabled: true, density: 0.46, swing: 0.05, octave: 5 },
        arp: { enabled: true, density: 0.64, swing: 0.04, octave: 5 },
      },
      mini: {
        drums: {
          kick: "x---x---x-x---x-",
          snare: "----x-------x---",
          hat: "x-x-xxx-x-x-xxx-",
          percussion: "--x---.--x---.--",
        },
        bassline: "0---0-3-4---3---",
        melodyMotif: "0-3-4---7-4-3---",
        arpPattern: "0347-7430347-743",
      },
      strudel: {
        version: 1,
        code: `stack(
  s("bd ~ ~ ~ bd ~ bd ~ ~ ~ bd ~ ~ ~ bd ~").gain(.88).cut(1).orbit(1),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").gain(.5).room(.12).orbit(1),
  s("hh ~ hh hh hh ~ hh ~ hh ~ hh hh hh ~ hh ~").gain(.34).hcutoff(2400).swingBy(.08, 8).orbit(1),
  note("c2 ~ c2 eb2 ~ g2 c2 ~ bb1 ~ c2 eb2 ~ g2 ~ c2").s("sawtooth").gain(.34).lpf(920).release(.12).orbit(2),
  note("<[c4 eb4 g4] [f4 ab4 c5] [ab3 c4 eb4] [bb3 d4 f4]>").s("sine").gain(.15).attack(.03).release(.58).room(.18).orbit(3),
  note("c5 eb5 g5 ~ bb5 g5 eb5 ~ c6 bb5 g5 ~ eb5 g5 bb5 ~").s("sine").gain(.2).delay(.08).pan("<.35 .65 .5>").orbit(4),
  note("c6 g5 eb6 bb5 c6 g6 eb6 bb5").s("sawtooth").gain(.1).attack(.005).release(.1).room(.16).orbit(5)
).cpm(26).analyze(1).sometimesBy(.2, x => x.jux(rev))`,
        notes: "Tight neon pulse with syncopated bass, glassy motif, and a thin saw arp for late-night focus.",
      },
    },
    source: "builtin",
  },
  {
    id: "rainy-lofi",
    name: "雨窗慢读",
    subtitle: "Rainroom Lofi",
    tagline: "水痕沿着窗玻璃下坠，书页和磁带一起放慢。",
    glyph: "❍",
    visual: "rain",
    palette: { accent: "#7dd3c7", accent2: "#8aa7d6", base: "#070a0e" },
    params: {
      energy: 0.32,
      warmth: 0.82,
      space: 0.66,
      brightness: 0.38,
      ambience: 0.58,
      density: 0.36,
      tempo: 72,
    },
    pattern: {
      root: "F",
      scale: "minorPentatonic",
      chords: ["im7", "ivm7", "VImaj7", "v"],
      seed: 7206,
      layers: {
        drums: { enabled: true, density: 0.34, swing: 0.18 },
        bass: { enabled: true, density: 0.3, swing: 0.12, octave: 2 },
        pad: { enabled: true, density: 0.44, swing: 0.08, octave: 4 },
        melody: { enabled: true, density: 0.3, swing: 0.1, octave: 5 },
        arp: { enabled: true, density: 0.2, swing: 0.06, octave: 5 },
      },
      mini: {
        drums: {
          kick: "x-----x-----x---",
          snare: "----x-------x---",
          hat: "x--x-xx-x--x-xx-",
          percussion: "--.---.---.---.-",
        },
        bassline: "0---4---3---4---",
        melodyMotif: "5---3---0---2---",
        arpPattern: "0353----2402----",
      },
      strudel: {
        version: 1,
        code: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.48).cut(1).orbit(1),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").gain(.3).room(.22).orbit(1),
  s("hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~ hh ~ ~").gain(.18).hcutoff(1550).swingBy(.17, 8).orbit(1),
  note("f2 ~ c3 ~ ab2 ~ c3 ~ db3 ~ ab2 ~ eb3 ~ c3 ~").s("triangle").gain(.24).lpf(720).release(.26).orbit(2),
  note("<[f3 ab3 c4] [db3 f3 ab3] [bb2 db3 f3] [c3 eb3 g3]>").s("sine").gain(.18).attack(.08).release(.9).room(.42).orbit(3),
  note("c5 ~ ab4 ~ f4 ~ eb4 ~ f4 ~ ab4 ~ c5 ~ eb5 ~").s("triangle").gain(.14).delay(.18).pan("<.38 .62 .48>").orbit(4),
  note("ab5 ~ ~ c5 ~ f5 ~ ~ eb5 ~ c5 ~ ab4 ~ c5 ~").s("sine").gain(.08).room(.3).orbit(5)
).cpm(18).analyze(1).sometimesBy(.12, x => x.echo(2, 1/8, .24))`,
        notes: "Loose brushed lo-fi groove, warm bass movement, and a small rainy-window melodic answer.",
      },
    },
    source: "builtin",
  },
  {
    id: "cyber-meditation",
    name: "数据禅房",
    subtitle: "Synthetic Breathing",
    tagline: "冷光缓慢起伏，像服务器深处的一次长呼吸。",
    glyph: "✺",
    visual: "waves",
    palette: { accent: "#b7a2ff", accent2: "#7dd3fc", base: "#080611" },
    params: {
      energy: 0.2,
      warmth: 0.48,
      space: 0.68,
      brightness: 0.54,
      ambience: 0.2,
      density: 0.24,
      tempo: 58,
    },
    pattern: {
      root: "D",
      scale: "dorian",
      chords: ["i", "IV", "i", "VII"],
      seed: 5809,
      layers: {
        drums: { enabled: false, density: 0.08, swing: 0.02 },
        bass: { enabled: true, density: 0.18, swing: 0.03, octave: 2 },
        pad: { enabled: true, density: 0.42, swing: 0.02, octave: 4 },
        melody: { enabled: true, density: 0.22, swing: 0.03, octave: 5 },
        arp: { enabled: true, density: 0.2, swing: 0.02, octave: 5 },
      },
      mini: {
        drums: {
          kick: "----------------",
          snare: "----------------",
          hat: "----------------",
          percussion: "----------------",
        },
        bassline: "0-------4-------",
        melodyMotif: "0---4---5---3---",
        arpPattern: "0---4---7---5---",
      },
      strudel: {
        version: 1,
        code: `stack(
  note("d2 ~ ~ ~ a2 ~ ~ ~ c3 ~ ~ ~ a2 ~ ~ ~").s("sine").gain(.18).lpf(620).release(.8).orbit(2),
  note("<[d3 f3 a3] [g3 b3 d4] [d3 f3 a3] [c3 e3 g3]>").s("sine").gain(.22).attack(.22).release(1.25).room(.48).orbit(3),
  note("a4 ~ d5 ~ f5 ~ a4 ~ g4 ~ f5 ~ c5 ~ a4 ~").s("triangle").gain(.15).delay(.18).pan("<.32 .68 .46 .6>").orbit(4),
  note("d6 ~ ~ a5 ~ f6 ~ ~ g5 ~ a5 ~ c6 ~ a5 ~").s("sine").gain(.09).attack(.02).release(.42).room(.36).orbit(5)
).cpm(14.5).analyze(1).sometimesBy(.14, x => x.ply(2).gain(.7))`,
        notes: "Beatless synthetic breathing with a low pulse, slow dorian pad, and small periodic light points.",
      },
    },
    source: "builtin",
  },
  {
    id: "deep-focus",
    name: "暖灯专注",
    subtitle: "Amber Focus",
    tagline: "台灯压低夜色，笔尖和鼓点保持同一个速度。",
    glyph: "▲",
    visual: "particles",
    palette: { accent: "#f4c15d", accent2: "#d88945", base: "#0c0805" },
    params: {
      energy: 0.44,
      warmth: 0.84,
      space: 0.4,
      brightness: 0.56,
      ambience: 0.22,
      density: 0.48,
      tempo: 82,
    },
    pattern: {
      root: "A",
      scale: "minorPentatonic",
      chords: ["im7", "VII", "VImaj7", "VII"],
      seed: 8011,
      layers: {
        drums: { enabled: true, density: 0.44, swing: 0.14 },
        bass: { enabled: true, density: 0.36, swing: 0.08, octave: 2 },
        pad: { enabled: true, density: 0.32, swing: 0.05, octave: 4 },
        melody: { enabled: true, density: 0.34, swing: 0.06, octave: 5 },
        arp: { enabled: true, density: 0.2, swing: 0.04, octave: 5 },
      },
      mini: {
        drums: {
          kick: "x-----x-----x---",
          snare: "----------------",
          hat: "x--x--x-x--x--x-",
          percussion: "----------------",
        },
        bassline: "0---4---3---4---",
        melodyMotif: "4---0---5---3---",
        arpPattern: "0240----3523----",
      },
      strudel: {
        version: 1,
        code: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.42).cut(1).orbit(1),
  s("hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh").gain(.18).hcutoff(1800).swingBy(.12, 8).orbit(1),
  note("a2 ~ e3 ~ c3 ~ e3 ~ g2 ~ d3 ~ c3 ~ e3 ~").s("triangle").gain(.28).lpf(780).release(.18).orbit(2),
  note("<[a3 c4 e4] [g3 b3 d4] [f3 a3 c4] [g3 b3 d4]>").s("sine").gain(.15).attack(.04).release(.62).room(.2).orbit(3),
  note("e5 ~ a4 ~ c5 ~ e5 ~ d5 ~ g4 ~ b4 ~ d5 ~").s("triangle").gain(.16).pan("<.45 .55 .5>").orbit(4),
  note("a5 ~ c5 e5 ~ g5 ~ d5 b4 ~ f5 ~ a4 c5 ~").s("sine").gain(.08).delay(.08).orbit(5)
).cpm(20.5).analyze(1).sometimesBy(.1, x => x.echo(2, 1/8, .2))`,
        notes: "Soft study groove with a steady kick, warm bass, and a restrained motif that avoids distraction.",
      },
    },
    source: "builtin",
  },
  {
    id: "forest-walk",
    name: "林间回声",
    subtitle: "Moss Walk",
    tagline: "湿润的绿意铺开，远处鸟鸣落在每一次脚步后面。",
    glyph: "✦",
    visual: "particles",
    palette: { accent: "#78d98a", accent2: "#b9df72", base: "#061008" },
    params: {
      energy: 0.38,
      warmth: 0.68,
      space: 0.56,
      brightness: 0.62,
      ambience: 0.52,
      density: 0.4,
      tempo: 78,
    },
    pattern: {
      root: "G",
      scale: "majorPentatonic",
      chords: ["Iadd9", "V", "vi", "IVmaj7"],
      seed: 7617,
      layers: {
        drums: { enabled: true, density: 0.28, swing: 0.08 },
        bass: { enabled: true, density: 0.3, swing: 0.05, octave: 2 },
        pad: { enabled: true, density: 0.42, swing: 0.04, octave: 4 },
        melody: { enabled: true, density: 0.36, swing: 0.04, octave: 5 },
        arp: { enabled: true, density: 0.24, swing: 0.03, octave: 5 },
      },
      mini: {
        drums: {
          kick: "x-----x-----x---",
          snare: "--.-----x---.--.",
          hat: "x--x--x-x--x--x-",
          percussion: "--.--.----.--.--",
        },
        bassline: "0---4---5---4---",
        melodyMotif: "2---4-5---4-2---",
        arpPattern: "0245--42--245---",
      },
      strudel: {
        version: 1,
        code: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.48).cut(1).orbit(1),
  s("~ ~ cp ~ ~ ~ ~ cp ~ ~ cp ~ ~ ~ ~ cp").gain(.17).room(.18).pan("<.35 .65>").orbit(1),
  s("hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh").gain(.15).hcutoff(2100).orbit(1),
  note("g2 ~ d3 ~ e3 ~ d3 ~ c3 ~ g2 ~ d3 ~ e3 ~").s("triangle").gain(.24).lpf(900).release(.2).orbit(2),
  note("<[g3 b3 d4] [d4 e4 g4] [e3 g3 b3] [c4 e4 g4]>").s("triangle").gain(.15).attack(.05).release(.72).room(.28).orbit(3),
  note("b4 ~ d5 ~ e5 d5 b4 ~ g4 ~ b4 ~ d5 ~ e5 ~").s("sine").gain(.17).delay(.12).pan("<.4 .6 .5>").orbit(4),
  note("g5 ~ b5 d6 ~ e6 ~ d6 b5 ~ c6 ~ b5 g5 ~").s("triangle").gain(.08).room(.18).orbit(5)
).cpm(19.5).analyze(1).sometimesBy(.14, x => x.echo(2, 1/8, .25))`,
        notes: "Organic walking pulse with soft percussion, bright pentatonic melody, and small echoing leaf-like arps.",
      },
    },
    source: "builtin",
  },
  {
    id: "cosmic-drift",
    name: "星云休眠",
    subtitle: "Nebula Drift",
    tagline: "身体慢慢失重，蓝色星尘像潮水一样远去。",
    glyph: "✷",
    visual: "cosmos",
    palette: { accent: "#6aa8ff", accent2: "#9b8cff", base: "#050711" },
    params: {
      energy: 0.16,
      warmth: 0.36,
      space: 0.96,
      brightness: 0.48,
      ambience: 0.46,
      density: 0.24,
      tempo: 52,
    },
    pattern: {
      root: "E",
      scale: "lydian",
      chords: ["I", "II", "V", "I"],
      seed: 5023,
      layers: {
        drums: { enabled: false, density: 0.06, swing: 0.01 },
        bass: { enabled: true, density: 0.12, swing: 0.02, octave: 2 },
        pad: { enabled: true, density: 0.72, swing: 0.01, octave: 4 },
        melody: { enabled: true, density: 0.18, swing: 0.02, octave: 5 },
        arp: { enabled: true, density: 0.14, swing: 0.02, octave: 5 },
      },
      mini: {
        drums: {
          kick: "----------------",
          snare: "----------------",
          hat: "----------------",
          percussion: "----------------",
        },
        bassline: "0-------4-------",
        melodyMotif: "0---4---5---3---",
        arpPattern: "0---4---7---5---",
      },
      strudel: {
        version: 1,
        code: `stack(
  note("e2 ~ ~ ~ b2 ~ ~ ~ f#3 ~ ~ ~ b2 ~ ~ ~").s("sine").gain(.16).lpf(560).release(1.1).orbit(2),
  note("<[e3 b3 f#4] [f#3 c#4 g#4] [b2 f#3 c#4] [e3 b3 f#4]>").s("sine").gain(.23).attack(.24).release(1.35).room(.52).orbit(3),
  note("b4 ~ e5 ~ f#5 ~ b4 ~ g#5 ~ f#5 ~ e5 ~ b4 ~").s("triangle").gain(.13).delay(.2).pan("<.3 .7 .45 .6>").orbit(4),
  note("e6 ~ ~ b5 ~ f#6 ~ ~ g#5 ~ b5 ~ e6 ~ b5 ~").s("sine").gain(.08).attack(.02).release(.5).room(.38).orbit(5)
).cpm(13).analyze(1).sometimesBy(.12, x => x.ply(2).gain(.68))`,
        notes: "Weightless lydian drift with slow bass gravity, wide pad bloom, and sparse star-like motifs.",
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
