import type { ScaleType, Vibe, VibeParams, VibePattern } from "@/data/vibes";
import { parseMiniPattern } from "@/music/miniPattern";

export interface MusicQualityIssue {
  code: string;
  severity: "warn" | "fail";
  message: string;
}

export interface MusicQualityReport {
  score: number;
  repaired: boolean;
  issues: MusicQualityIssue[];
}

export interface MusicQualityResult {
  vibe: Vibe;
  report: MusicQualityReport;
}

type Scene = "spring" | "rain" | "neon" | "focus" | "space" | "winter" | "forest" | "coastal" | "neutral";

const SPRING_CHORDS = ["Iadd9", "V", "vi", "IVmaj7"];
const SPRING_MINI = {
  drums: {
    kick: "x---x-----x---x-",
    snare: "----x-------x---",
    hat: "x-x-xx-x-x-x-xx-",
    percussion: "--.-.--.----.--.",
  },
  bassline: "0---4---5---4---",
  melodyMotif: "0-2-4---5-4-2---",
  arpPattern: "0245--42--245---",
};

const NEON_MINI = {
  drums: {
    kick: "x---x---x-x---x-",
    snare: "----x-------x---",
    hat: "x-x-xxx-x-x-xxx-",
    percussion: "--x---.--x---.--",
  },
  bassline: "0---0-3-4---3---",
  melodyMotif: "0-3-4---7-4-3---",
  arpPattern: "0347-7430347-743",
};

const RAIN_MINI = {
  drums: {
    kick: "x-----x-----x---",
    snare: "----x-------x---",
    hat: "x--x-xx-x--x-xx-",
    percussion: "--.---.---.---.-",
  },
  bassline: "0---4---3---4---",
  melodyMotif: "5---3---0---2---",
  arpPattern: "0353----2402----",
};

const FOREST_MINI = {
  drums: {
    kick: "x-----x-----x---",
    snare: "--.-----x---.--.",
    hat: "x--x--x-x--x--x-",
    percussion: "--.--.----.--.--",
  },
  bassline: "0---4---5---4---",
  melodyMotif: "2---4-5---4-2---",
  arpPattern: "0245--42--245---",
};

const COASTAL_MINI = {
  drums: {
    kick: "x---x-----x---x-",
    snare: "----x-------x---",
    hat: "x-x-x-xxx-x-x-xx",
    percussion: "--.---.--.---.--",
  },
  bassline: "0---4---5---4---",
  melodyMotif: "2-4-5---7-5-4---",
  arpPattern: "0245-5420245-542",
};

const WINTER_MINI = {
  drums: {
    kick: "----------------",
    snare: "----------------",
    hat: "----------------",
    percussion: "----------------",
  },
  bassline: "0-------4-------",
  melodyMotif: "0---4---5---4---",
  arpPattern: "0---2---4---5---",
};

const SPACE_MINI = {
  drums: {
    kick: "----------------",
    snare: "----------------",
    hat: "----------------",
    percussion: "----------------",
  },
  bassline: "0-------4-------",
  melodyMotif: "0---4---5---3---",
  arpPattern: "0---4---7---5---",
};

const FOCUS_MINI = {
  drums: {
    kick: "x-----x-----x---",
    snare: "----------------",
    hat: "x--x--x-x--x--x-",
    percussion: "----------------",
  },
  bassline: "0---4---3---4---",
  melodyMotif: "4---0---5---3---",
  arpPattern: "0240----3523----",
};

const REPAIR_STRUDEL_BY_SCENE: Partial<Record<Scene, string>> = {
  spring: `stack(
  s("bd ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~").gain(.72).cut(1).orbit(1),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").gain(.38).room(.1).orbit(1),
  s("hh ~ hh ~ hh hh ~ hh ~ hh ~ hh hh ~ hh ~").gain(.28).hcutoff(2200).orbit(1),
  note("g3 ~ d4 ~ e4 ~ b3 ~ c4 ~ d4 ~ b3 ~ g3 ~").s("triangle").gain(.32).lpf(1800).release(.18).orbit(2),
  note("<[g4 b4 d5 a4] [d5 e5 g5 b4] [e5 g5 b5 d5] [c5 e5 g5 b4]>").s("triangle").gain(.18).attack(.02).release(.46).room(.24).orbit(3),
  note("g5 b5 d6 ~ e6 d6 b5 ~ c6 b5 g5 ~ d6 e6 g6 ~").s("sine").gain(.22).delay(.08).pan("<.42 .58 .5>").orbit(4)
).cpm(23).analyze(1).sometimesBy(.18, x => x.echo(2, 1/8, .34))`,
  neon: `stack(
  s("bd ~ ~ ~ bd ~ bd ~ ~ ~ bd ~ ~ ~ bd ~").gain(.86).cut(1).orbit(1),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").gain(.55).room(.12).orbit(1),
  s("hh ~ hh hh hh ~ hh ~ hh ~ hh hh hh ~ hh ~").gain(.36).hcutoff(2400).swingBy(.08, 8).orbit(1),
  note("c2 ~ c2 eb2 ~ g2 c2 ~ bb1 ~ c2 eb2 ~ g2 ~ c2").s("sawtooth").gain(.36).lpf(900).release(.12).orbit(2),
  note("c4 eb4 g4 bb4 g4 eb4 c4 ~ c5 bb4 g4 eb4 g4 bb4 c5 ~").s("sine").gain(.2).delay(.1).pan("<.35 .65>").orbit(4),
  note("c5 g4 eb5 bb4 c5 g5 eb5 bb4").s("sawtooth").gain(.13).attack(.005).release(.1).room(.18).orbit(5)
).cpm(26).analyze(1).sometimesBy(.22, x => x.jux(rev))`,
  space: `stack(
  note("<[c3 g3 d4] [bb2 f3 c4] [ab2 eb3 bb3] [g2 d3 a3]>").s("sine").gain(.24).attack(.18).release(1.2).room(.46).orbit(3),
  note("c5 ~ g4 ~ d5 ~ bb4 ~ ab4 ~ eb5 ~ g4 ~ d5 ~").s("triangle").gain(.18).delay(.18).pan("<.3 .7 .45 .6>").orbit(4),
  note("c6 ~ ~ g5 ~ d6 ~ ~ bb5 ~ ab5 ~ eb6 ~ g5 ~").s("sine").gain(.1).attack(.02).release(.42).room(.34).orbit(5)
).cpm(14).analyze(1).sometimesBy(.16, x => x.ply(2).gain(.72))`,
  focus: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.42).cut(1).orbit(1),
  s("hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh").gain(.18).hcutoff(1800).orbit(1),
  note("c2 ~ g2 ~ eb2 ~ g2 ~ bb1 ~ f2 ~ eb2 ~ g2 ~").s("triangle").gain(.28).lpf(760).release(.18).orbit(2),
  note("<[c4 eb4 g4] [bb3 d4 f4] [ab3 c4 eb4] [g3 bb3 d4]>").s("sine").gain(.16).attack(.04).release(.62).room(.22).orbit(3),
  note("g4 ~ c5 ~ eb5 ~ g4 ~ f4 ~ bb4 ~ d5 ~ f4 ~").s("triangle").gain(.16).pan("<.45 .55>").orbit(4)
).cpm(20).analyze(1).sometimesBy(.1, x => x.echo(2, 1/8, .22))`,
  rain: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.48).cut(1).orbit(1),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").gain(.32).room(.22).orbit(1),
  s("hh ~ ~ hh ~ hh ~ ~ hh ~ ~ hh ~ hh ~ ~").gain(.18).hcutoff(1600).swingBy(.16, 8).orbit(1),
  note("f2 ~ c3 ~ ab2 ~ c3 ~ db3 ~ ab2 ~ eb3 ~ c3 ~").s("triangle").gain(.24).lpf(720).release(.24).orbit(2),
  note("<[f3 ab3 c4] [db3 f3 ab3] [bb2 db3 f3] [c3 eb3 g3]>").s("sine").gain(.18).attack(.08).release(.9).room(.44).orbit(3),
  note("c5 ~ ab4 ~ f4 ~ eb4 ~ f4 ~ ab4 ~ c5 ~ eb5 ~").s("triangle").gain(.14).delay(.18).pan("<.38 .62 .48>").orbit(4)
).cpm(18).analyze(1).sometimesBy(.12, x => x.echo(2, 1/8, .24))`,
  winter: `stack(
  note("<[d3 a3 e4] [bb2 f3 c4] [g2 d3 a3] [a2 e3 b3]>").s("sine").gain(.22).attack(.16).release(1.1).room(.38).orbit(3),
  note("d4 ~ a3 ~ e4 ~ f4 ~ g4 ~ e4 ~ d4 ~ a3 ~").s("triangle").gain(.18).lpf(1600).delay(.12).pan("<.42 .58>").orbit(4),
  note("a4 ~ ~ d5 ~ e5 ~ ~ f5 ~ e5 ~ d5 ~ a4 ~").s("sine").gain(.11).attack(.02).release(.5).room(.28).orbit(5)
).cpm(15).analyze(1).sometimesBy(.14, x => x.ply(2).gain(.68))`,
  forest: `stack(
  s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~").gain(.5).cut(1).orbit(1),
  s("~ ~ cp ~ ~ ~ ~ cp ~ ~ cp ~ ~ ~ ~ cp").gain(.18).room(.18).pan("<.35 .65>").orbit(1),
  s("hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh ~ ~ hh").gain(.16).hcutoff(2100).orbit(1),
  note("g2 ~ d3 ~ e3 ~ d3 ~ c3 ~ g2 ~ d3 ~ e3 ~").s("triangle").gain(.24).lpf(900).release(.2).orbit(2),
  note("<[g3 b3 d4] [d4 e4 g4] [c4 e4 g4] [d4 f#4 a4]>").s("triangle").gain(.16).attack(.05).release(.7).room(.3).orbit(3),
  note("b4 ~ d5 ~ e5 d5 b4 ~ g4 ~ b4 ~ d5 ~ e5 ~").s("sine").gain(.17).delay(.12).pan("<.4 .6 .5>").orbit(4)
).cpm(19).analyze(1).sometimesBy(.14, x => x.echo(2, 1/8, .25))`,
  coastal: `stack(
  s("bd ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~").gain(.62).cut(1).orbit(1),
  s("~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~").gain(.28).room(.18).orbit(1),
  s("hh ~ hh ~ hh ~ hh hh ~ hh ~ hh ~ hh hh ~").gain(.22).hcutoff(2300).swingBy(.08, 8).orbit(1),
  note("a2 ~ e3 ~ f#3 ~ e3 ~ d3 ~ a2 ~ e3 ~ f#3 ~").s("triangle").gain(.27).lpf(980).release(.18).orbit(2),
  note("<[a3 c#4 e4] [e4 f#4 a4] [d4 f#4 a4] [e4 g#4 b4]>").s("sine").gain(.15).attack(.04).release(.64).room(.28).orbit(3),
  note("c#5 e5 f#5 ~ a5 f#5 e5 ~ d5 e5 f#5 ~ b4 c#5 e5 ~").s("triangle").gain(.18).delay(.1).pan("<.32 .68 .48 .58>").orbit(4)
).cpm(24).analyze(1).sometimesBy(.16, x => x.echo(2, 1/8, .3))`,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function detectScene(prompt: string, vibe: Vibe): Scene {
  const text = `${prompt} ${vibe.id} ${vibe.name} ${vibe.subtitle} ${vibe.tagline}`.toLowerCase();
  if (/夏|海|浪|beach|ocean|sea|wave|coast|coastal|island/.test(text)) return "coastal";
  if (/森林|forest|walk|苔|湿土|鸟|moss|woods/.test(text)) return "forest";
  if (/春|樱|花|sakura|cherry|blossom|spring|garden|日光|阳光|清晨|微风|breeze/.test(text)) return "spring";
  if (/雨|rain|lo-?fi|lofi|窗|夜读/.test(text)) return "rain";
  if (/代码|霓虹|city|城市|coding|neon|cyber|club|dance/.test(text)) return "neon";
  if (/学习|专注|focus|study|阅读|read/.test(text)) return "focus";
  if (/宇宙|星|space|cosmic|漂浮|galaxy/.test(text)) return "space";
  if (/雪|冬|winter|snow|冷|孤独/.test(text)) return "winter";
  return "neutral";
}

function ratio(count: number, steps: number) {
  return steps > 0 ? count / steps : 0;
}

function degreeStats(events: { degree: number }[]) {
  const unique = new Set(events.map((event) => event.degree));
  const degrees = events.map((event) => event.degree);
  return {
    count: events.length,
    unique: unique.size,
    span: degrees.length ? Math.max(...degrees) - Math.min(...degrees) : 0,
  };
}

function splitStrudelCode(code: string) {
  let outside = "";
  const strings: string[] = [];
  let current = "";
  let quote: string | null = null;
  let escaped = false;

  for (const char of code) {
    if (quote) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        strings.push(current);
        current = "";
        outside += "\"\"";
        quote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    outside += char;
  }

  return { outside, strings };
}

function countFunctionCalls(outsideCode: string, name: string) {
  const matches = outsideCode.match(new RegExp(`\\b${name}\\s*\\(`, "g"));
  return matches?.length ?? 0;
}

function countStackLayers(code: string) {
  const start = code.search(/\bstack\s*\(/);
  if (start < 0) return 0;

  const open = code.indexOf("(", start);
  let depth = 0;
  let layers = 1;
  let quote: string | null = null;
  let escaped = false;
  let hasContent = false;

  for (let index = open + 1; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      hasContent = true;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) return hasContent ? layers : 0;
      depth -= 1;
    }
    if (char === "," && depth === 0) layers += 1;
    if (!/\s|,/.test(char)) hasContent = true;
  }

  return hasContent ? layers : 0;
}

function extractNoteNames(strings: string[]) {
  return strings.flatMap((value) => value.toLowerCase().match(/[a-g](?:#|b)?\d/g) ?? []);
}

function numericMethodArgs(outsideCode: string, method: string) {
  const values: number[] = [];
  const matcher = new RegExp(`\\.${method}\\s*\\(\\s*([0-9]*\\.?[0-9]+)`, "g");
  let match: RegExpExecArray | null = matcher.exec(outsideCode);
  while (match) {
    values.push(Number(match[1]));
    match = matcher.exec(outsideCode);
  }
  return values.filter((value) => Number.isFinite(value));
}

function evaluateNativeStrudelCode(
  issues: MusicQualityIssue[],
  scene: Scene,
  pattern: VibePattern,
  params: VibeParams,
) {
  const code = pattern.strudel?.code?.trim();
  if (!code) {
    if (REPAIR_STRUDEL_BY_SCENE[scene]) {
      addIssue(issues, "fail", "missing-native-strudel", "已识别场景但缺少原生 Strudel pattern，将注入本地 repair recipe。");
    } else {
      addIssue(issues, "warn", "missing-native-strudel", "缺少原生 Strudel pattern，听感会退回结构化 adapter。");
    }
    return;
  }

  const { outside, strings } = splitStrudelCode(code);
  const stackLayers = countStackLayers(code);
  const noteCalls = countFunctionCalls(outside, "note");
  const sampleCalls = countFunctionCalls(outside, "s") + countFunctionCalls(outside, "sound");
  const noteNames = extractNoteNames(strings);
  const uniqueNotes = new Set(noteNames);
  const roomValues = numericMethodArgs(outside, "room");
  const delayValues = numericMethodArgs(outside, "delay");
  const hasCpm = /\.\s*cpm\s*\(/.test(outside);
  const hasAnalyzer = /\.\s*analyze\s*\(/.test(outside);
  const hasVariation = /\.\s*(sometimesBy|sometimes|echo|jux|ply|pan|swingBy|euclid|iter|palindrome|delay)\s*\(/.test(outside);

  if (!/^\s*stack\s*\(/.test(outside)) {
    addIssue(issues, "fail", "native-not-stack", "原生 Strudel 不是多层 stack，最终听感容易单薄。");
  }

  if (stackLayers > 0 && stackLayers < 3 && scene !== "focus") {
    addIssue(issues, "fail", "native-too-few-layers", "原生 Strudel 层数太少，缺少鼓、低音、旋律或空间的组合。");
  }

  if (noteCalls === 0 && scene !== "rain") {
    addIssue(issues, "fail", "native-missing-note", "原生 Strudel 缺少 note(...) 前景声部，容易只剩节奏或噪声。");
  }

  if (noteCalls > 0 && noteNames.length >= 4 && uniqueNotes.size <= 2) {
    addIssue(issues, "fail", "native-note-drone", "原生 Strudel 旋律接近单音循环，容易产生 drone 感。");
  }

  if (pattern.layers.drums?.enabled !== false && sampleCalls === 0 && scene !== "space" && scene !== "focus") {
    addIssue(issues, "warn", "native-missing-samples", "原生 Strudel 缺少 sample 鼓层，律动重心可能不足。");
  }

  if (!hasVariation && scene !== "focus") {
    addIssue(issues, "warn", "native-static-loop", "原生 Strudel 缺少 pan、delay、echo 或 variation，循环可能过于机械。");
  }

  if (!hasCpm) {
    addIssue(issues, "warn", "native-missing-cpm", "原生 Strudel 缺少 .cpm(...)，会由播放器兜底补齐。");
  }

  if (!hasAnalyzer) {
    addIssue(issues, "warn", "native-missing-analyze", "原生 Strudel 缺少 .analyze(1)，视觉频谱联动会由播放器兜底补齐。");
  }

  if (roomValues.some((value) => value > 0.72) || delayValues.some((value) => value > 0.45)) {
    addIssue(
      issues,
      scene === "space" || scene === "rain" || scene === "forest" || scene === "coastal" ? "warn" : "fail",
      "native-too-wet",
      "原生 Strudel 空间或延迟过重，容易糊成背景嗡鸣。",
    );
  }

  if (scene === "spring" && params.ambience + params.space > 0.82 && roomValues.some((value) => value > 0.48)) {
    addIssue(issues, "fail", "native-spring-too-wet", "春日/樱花的原生 Strudel 空间太湿，容易听成冷雾或雪景。");
  }
}

function hasMinorHeavyProgression(pattern: VibePattern) {
  return pattern.chords.some((chord) => /^i($|m|v|i|7|sus|add)/.test(chord) && !/^iv?maj/i.test(chord));
}

function addIssue(issues: MusicQualityIssue[], severity: MusicQualityIssue["severity"], code: string, message: string) {
  issues.push({ severity, code, message });
}

function scoreFromIssues(issues: MusicQualityIssue[]) {
  return clamp(
    100 -
      issues.reduce((score, issue) => {
        return score + (issue.severity === "fail" ? 18 : 8);
      }, 0),
    0,
    100,
  );
}

export function evaluateMusicQuality(prompt: string, vibe: Vibe): MusicQualityReport {
  const issues: MusicQualityIssue[] = [];
  const scene = detectScene(prompt, vibe);
  const params = vibe.params;
  const pattern = vibe.pattern;

  if (!pattern) {
    addIssue(issues, "fail", "missing-pattern", "缺少音乐 pattern。");
    return { score: scoreFromIssues(issues), repaired: false, issues };
  }

  const mini = parseMiniPattern(pattern.mini);
  const drums = mini.drums;
  const kickRatio = ratio(drums.kick.length, mini.steps);
  const snareRatio = ratio(drums.snare.length, mini.steps);
  const hatRatio = ratio(drums.hat.length, mini.steps);
  const bass = degreeStats(mini.bassline);
  const melody = degreeStats(mini.melodyMotif);
  const arp = degreeStats(mini.arpPattern);
  const melodyOrArpCount = melody.count + arp.count;
  const totalEventRatio = ratio(
    drums.kick.length +
      drums.snare.length +
      drums.hat.length +
      drums.percussion.length +
      mini.bassline.length +
      mini.melodyMotif.length +
      mini.arpPattern.length,
    mini.steps * 7,
  );
  const padDensity = pattern.layers.pad?.density ?? 0.4;

  evaluateNativeStrudelCode(issues, scene, pattern, params);

  if (pattern.layers.drums?.enabled !== false) {
    if (kickRatio < 0.08) addIssue(issues, "warn", "weak-kick", "鼓组缺少低频重心。");
    if (snareRatio < 0.04 && scene !== "focus" && scene !== "space") addIssue(issues, "warn", "weak-backbeat", "鼓组缺少 backbeat 或轻拍。");
    if (hatRatio > 0.86) addIssue(issues, "warn", "overbusy-hat", "高频鼓点过密，容易显得廉价和刺耳。");
  }

  if (bass.count > 0 && bass.unique <= 1 && bass.count >= mini.steps * 0.25) {
    addIssue(issues, "fail", "bass-drone", "低音接近单音 drone，削弱和弦运动。");
  }

  if (pattern.layers.melody?.enabled !== false && melody.count < 3 && arp.count < 5) {
    addIssue(issues, "fail", "missing-foreground", "缺少可记忆的旋律或 arp 前景。");
  }

  if (melody.count >= 4 && melody.unique <= 2 && melody.span <= 2) {
    addIssue(issues, "warn", "flat-melody", "旋律音域太窄，场景辨识度不足。");
  }

  if (totalEventRatio > 0.68) {
    addIssue(issues, "warn", "overdense-loop", "多层同时过密，循环容易糊成一团。");
  }

  if (params.ambience + params.space + padDensity > 1.45 && scene !== "rain" && scene !== "space" && scene !== "forest" && scene !== "coastal") {
    addIssue(issues, "fail", "muddy-bed", "环境、空间和 pad 同时偏重，容易出现嗡嗡铺底盖过主题。");
  }

  if ((scene === "forest" || scene === "coastal") && params.ambience + params.space + padDensity > 1.7) {
    addIssue(issues, "warn", "natural-bed-heavy", "自然场景的环境层偏重，需要确保旋律前景仍然清晰。");
  }

  if (scene === "spring") {
    if (!["major", "majorPentatonic", "lydian"].includes(pattern.scale)) {
      addIssue(issues, "fail", "spring-scale", "春日/樱花场景不应使用暗色调式作为默认。");
    }
    if (hasMinorHeavyProgression(pattern)) {
      addIssue(issues, "fail", "spring-minor-progression", "春日/樱花场景不应使用 minor-heavy 和弦走向。");
    }
    if (params.brightness < 0.62) addIssue(issues, "fail", "spring-dark", "春日/樱花场景亮度过低。");
    if (params.ambience > 0.28) addIssue(issues, "fail", "spring-ambience", "春日/樱花场景环境层过重。");
    if (params.space > 0.62) addIssue(issues, "warn", "spring-space", "春日/樱花场景空间过大，容易变成冷雾或雪景。");
    if (padDensity > 0.52) addIssue(issues, "warn", "spring-pad-density", "春日/樱花场景 pad 过厚。");
    if (melodyOrArpCount < 8) addIssue(issues, "fail", "spring-no-sparkle", "春日/樱花场景需要轻盈旋律或闪烁 arp。");
  }

  if ((scene === "rain" || scene === "winter" || scene === "space") && params.brightness > 0.9) {
    addIssue(issues, "warn", "too-bright-for-dark-scene", "偏暗场景亮度过高，可能破坏氛围。");
  }

  if (scene === "neon" && pattern.layers.drums?.enabled !== false && kickRatio < 0.18) {
    addIssue(issues, "warn", "neon-weak-pulse", "霓虹/代码场景需要更明确的脉冲。");
  }

  return { score: scoreFromIssues(issues), repaired: false, issues };
}

function repairParams(scene: Scene, params: VibeParams): VibeParams {
  if (scene === "spring") {
    return {
      ...params,
      energy: clamp(params.energy, 0.38, 0.62),
      space: clamp(params.space, 0.3, 0.52),
      brightness: clamp(params.brightness, 0.68, 0.88),
      ambience: clamp(params.ambience, 0.06, 0.24),
      density: clamp(params.density, 0.36, 0.58),
      tempo: clamp(params.tempo, 82, 104),
    };
  }

  if (scene === "neon") {
    return {
      ...params,
      energy: clamp(params.energy, 0.52, 0.82),
      ambience: clamp(params.ambience, 0.08, 0.32),
      density: clamp(params.density, 0.42, 0.72),
      tempo: clamp(params.tempo, 88, 124),
    };
  }

  if (scene === "forest") {
    return {
      ...params,
      energy: clamp(params.energy, 0.32, 0.56),
      space: clamp(params.space, 0.36, 0.62),
      brightness: clamp(params.brightness, 0.52, 0.76),
      ambience: clamp(params.ambience, 0.28, 0.58),
      density: clamp(params.density, 0.34, 0.58),
      tempo: clamp(params.tempo, 72, 92),
    };
  }

  if (scene === "coastal") {
    return {
      ...params,
      energy: clamp(params.energy, 0.42, 0.66),
      space: clamp(params.space, 0.36, 0.62),
      brightness: clamp(params.brightness, 0.62, 0.84),
      ambience: clamp(params.ambience, 0.24, 0.52),
      density: clamp(params.density, 0.36, 0.62),
      tempo: clamp(params.tempo, 84, 108),
    };
  }

  if (scene === "rain") {
    return {
      ...params,
      energy: clamp(params.energy, 0.24, 0.46),
      space: clamp(params.space, 0.44, 0.72),
      brightness: clamp(params.brightness, 0.28, 0.56),
      ambience: clamp(params.ambience, 0.34, 0.68),
      density: clamp(params.density, 0.24, 0.48),
      tempo: clamp(params.tempo, 64, 86),
    };
  }

  if (scene === "winter") {
    return {
      ...params,
      energy: clamp(params.energy, 0.14, 0.38),
      space: clamp(params.space, 0.42, 0.68),
      brightness: clamp(params.brightness, 0.34, 0.62),
      ambience: clamp(params.ambience, 0.18, 0.48),
      density: clamp(params.density, 0.18, 0.42),
      tempo: clamp(params.tempo, 54, 78),
    };
  }

  return {
    ...params,
    ambience: clamp(params.ambience, 0, scene === "space" ? 0.72 : 0.42),
    space: clamp(params.space, 0, 0.78),
  };
}

function repairPattern(scene: Scene, pattern: VibePattern): VibePattern {
  if (scene === "spring") {
    return {
      ...pattern,
      scale: (["major", "majorPentatonic", "lydian"].includes(pattern.scale) ? pattern.scale : "majorPentatonic") as ScaleType,
      chords: SPRING_CHORDS,
      mini: SPRING_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: true, density: clamp(pattern.layers.drums.density, 0.34, 0.58) },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.3, 0.52), octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: clamp(pattern.layers.pad.density, 0.22, 0.46), octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.42, 0.72), octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.38, 0.68), octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.spring ?? "",
        notes: "本地修复：明亮春日 recipe，轻鼓、清晰 motif、克制空间。",
      },
    };
  }

  if (scene === "neon") {
    return {
      ...pattern,
      mini: NEON_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: true, density: clamp(pattern.layers.drums.density, 0.5, 0.78) },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.42, 0.7) },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.34, 0.64) },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.46, 0.78) },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.neon ?? "",
        notes: "本地修复：霓虹/代码 recipe，明确脉冲、切分低音和合成器前景。",
      },
    };
  }

  if (scene === "rain") {
    return {
      ...pattern,
      scale: "minorPentatonic",
      mini: RAIN_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: true, density: clamp(pattern.layers.drums.density, 0.22, 0.46), swing: 0.16, octave: 3 },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.22, 0.44), octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: clamp(pattern.layers.pad.density, 0.3, 0.54), octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.24, 0.5), octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.16, 0.38), octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.rain ?? "",
        notes: "本地修复：雨天 recipe，松弛鼓组、温和和声和可辨认前景旋律。",
      },
    };
  }

  if (scene === "forest") {
    return {
      ...pattern,
      scale: "majorPentatonic",
      chords: ["I", "V", "vi", "IV"],
      mini: FOREST_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: true, density: clamp(pattern.layers.drums.density, 0.28, 0.5), swing: 0.08, octave: 3 },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.28, 0.48), octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: clamp(pattern.layers.pad.density, 0.26, 0.5), octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.34, 0.58), octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.28, 0.52), octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.forest ?? "",
        notes: "本地修复：森林 recipe，自然脉冲、木质低音和清晰鸟鸣感 motif。",
      },
    };
  }

  if (scene === "coastal") {
    return {
      ...pattern,
      scale: "majorPentatonic",
      chords: ["Iadd9", "V", "IVmaj7", "V"],
      mini: COASTAL_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: true, density: clamp(pattern.layers.drums.density, 0.38, 0.62), swing: 0.08, octave: 3 },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.32, 0.54), octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: clamp(pattern.layers.pad.density, 0.22, 0.46), octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.42, 0.66), octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.38, 0.64), octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.coastal ?? "",
        notes: "本地修复：海边 recipe，轻快浪涌律动和明亮旋律。",
      },
    };
  }

  if (scene === "winter") {
    return {
      ...pattern,
      scale: "minorPentatonic",
      mini: WINTER_MINI,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: false, density: 0.08, swing: 0.02, octave: 3 },
        bass: { ...pattern.layers.bass, enabled: true, density: clamp(pattern.layers.bass.density, 0.14, 0.34), octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: clamp(pattern.layers.pad.density, 0.34, 0.58), octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: clamp(pattern.layers.melody.density, 0.18, 0.42), octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: clamp(pattern.layers.arp.density, 0.16, 0.38), octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE.winter ?? "",
        notes: "本地修复：冬雪 recipe，冷色空间但保留清晰光点旋律。",
      },
    };
  }

  if (scene === "space" || scene === "focus") {
    const mini = scene === "space" ? SPACE_MINI : FOCUS_MINI;
    return {
      ...pattern,
      mini,
      layers: {
        ...pattern.layers,
        drums: { ...pattern.layers.drums, enabled: scene === "focus", density: scene === "focus" ? 0.26 : 0.06, swing: 0.04, octave: 3 },
        bass: { ...pattern.layers.bass, enabled: true, density: scene === "focus" ? 0.32 : 0.18, octave: 2 },
        pad: { ...pattern.layers.pad, enabled: true, density: scene === "focus" ? 0.32 : 0.52, octave: 4 },
        melody: { ...pattern.layers.melody, enabled: true, density: scene === "focus" ? 0.3 : 0.22, octave: 5 },
        arp: { ...pattern.layers.arp, enabled: true, density: scene === "focus" ? 0.22 : 0.2, octave: 5 },
      },
      strudel: {
        version: 1,
        code: REPAIR_STRUDEL_BY_SCENE[scene] ?? "",
        notes: scene === "space" ? "本地修复：空间 recipe，长 pad 之外保留清晰光点旋律。" : "本地修复：专注 recipe，低密度律动和稳定前景 motif。",
      },
    };
  }

  return {
    ...pattern,
    strudel: undefined,
  };
}

function withQuality(vibe: Vibe, report: MusicQualityReport): Vibe {
  return {
    ...vibe,
    musicQuality: {
      score: report.score,
      repaired: report.repaired,
      issues: report.issues,
    },
  };
}

export function enforceMusicQuality(prompt: string, vibe: Vibe): MusicQualityResult {
  const initial = evaluateMusicQuality(prompt, vibe);
  const shouldRepair = initial.issues.some((issue) => issue.severity === "fail");

  if (!shouldRepair || !vibe.pattern) {
    return { vibe: withQuality(vibe, initial), report: initial };
  }

  const scene = detectScene(prompt, vibe);
  const repairedPattern = repairPattern(scene, vibe.pattern);
  const repairedVibe: Vibe = {
    ...vibe,
    params: repairParams(scene, vibe.params),
    pattern: repairedPattern,
  };
  const repaired = evaluateMusicQuality(prompt, repairedVibe);
  const initialFailures = initial.issues.filter((issue) => issue.severity === "fail");
  const repairedWarnings = repaired.issues.filter((issue) => issue.severity === "warn");

  const report = {
    ...repaired,
    repaired: true,
    issues: [...initialFailures, ...repairedWarnings].slice(0, 12),
  };

  return {
    vibe: withQuality(repairedVibe, report),
    report,
  };
}
