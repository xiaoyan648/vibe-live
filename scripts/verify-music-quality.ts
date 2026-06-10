import { buildStrudelCode } from "../src/audio/strudelCode";
import type { ScaleType, Vibe, VibePattern } from "../src/data/vibes";
import { enforceMusicQuality, evaluateMusicQuality } from "../src/music/quality";
import { sanitizeStrudelCode } from "../src/music/strudelSafety";

type Case = {
  id: string;
  prompt: string;
  marker: string;
  scale?: ScaleType;
  missingNative?: boolean;
};

const CASES: Case[] = [
  { id: "spring", prompt: "春日樱花下的轻盈旋律", marker: "g5 b5 d6", scale: "minor" },
  { id: "neon", prompt: "凌晨三点写代码的霓虹鼓点", marker: "c2 ~ c2 eb2" },
  { id: "space", prompt: "漂浮在宇宙星云里的冥想电子", marker: "c5 ~ g4 ~ d5" },
  { id: "focus", prompt: "低保真学习和稳定专注", marker: "g4 ~ c5 ~ eb5" },
  { id: "rain", prompt: "雨夜窗边低保真阅读", marker: "f2 ~ c3 ~ ab2", missingNative: true },
  { id: "forest", prompt: "森林散步 苔藓 湿土 鸟鸣", marker: "g2 ~ d3 ~ e3", missingNative: true },
  { id: "coastal", prompt: "夏日海边浪花和阳光", marker: "a2 ~ e3 ~ f#3", missingNative: true },
  { id: "winter", prompt: "冬日雪夜的冷空气", marker: "d4 ~ a3 ~ e4" },
];

function makePattern(input: Case): VibePattern {
  return {
    root: "C",
    scale: input.scale ?? "minorPentatonic",
    chords: ["i", "VI", "III", "VII"],
    seed: 20260609,
    layers: {
      drums: { enabled: true, density: 0.4, swing: 0.08, octave: 3 },
      bass: { enabled: true, density: 0.38, swing: 0.06, octave: 2 },
      pad: { enabled: true, density: 0.4, swing: 0.03, octave: 4 },
      melody: { enabled: true, density: 0.4, swing: 0.04, octave: 5 },
      arp: { enabled: true, density: 0.38, swing: 0.04, octave: 5 },
    },
    mini: {
      drums: {
        kick: "x---x---x---x---",
        snare: "----x-------x---",
        hat: "x-x-x-x-x-x-x-x-",
        percussion: "----------------",
      },
      bassline: "0---0---0---0---",
      melodyMotif: "0---0---0---0---",
      arpPattern: "0---0---0---0---",
    },
    strudel: input.missingNative
      ? undefined
      : {
          version: 1,
          code: 'note("c2 c2 c2 c2 c2 c2 c2 c2").s("sine").room(.9).cpm(20).analyze(1)',
          notes: "Intentionally bad native pattern for verification.",
        },
  };
}

function makeVibe(input: Case): Vibe {
  return {
    id: `${input.id}-verify`,
    name: input.id,
    subtitle: input.id,
    tagline: input.prompt,
    glyph: "V",
    visual: "particles",
    palette: { accent: "#8bd3ff", accent2: "#b8f7a1", base: "#07100c" },
    params: {
      energy: 0.42,
      warmth: 0.54,
      space: 0.48,
      brightness: 0.58,
      ambience: 0.42,
      density: 0.42,
      tempo: 82,
    },
    pattern: makePattern(input),
    source: "ai",
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const rows = CASES.map((testCase) => {
    const result = enforceMusicQuality(testCase.prompt, makeVibe(testCase));
    const code = buildStrudelCode(result.vibe, result.vibe.params);
    const repairedReport = evaluateMusicQuality(testCase.prompt, result.vibe);
    const failIssues = repairedReport.issues.filter((issue) => issue.severity === "fail");

    assert(result.report.repaired, `${testCase.id}: expected quality gate to repair`);
    assert(code.includes(testCase.marker), `${testCase.id}: expected repair recipe marker ${testCase.marker}`);
    assert(!code.includes('note("c2 c2 c2'), `${testCase.id}: bad native pattern was not replaced`);
    assert(Boolean(sanitizeStrudelCode(code)), `${testCase.id}: final Strudel code failed sanitizer`);
    assert(/^stack\s*\(/.test(code.trim()), `${testCase.id}: final Strudel code is not stack(...)`);
    assert(/\bnote\s*\(/.test(code), `${testCase.id}: final Strudel code has no note(...) layer`);
    assert(failIssues.length === 0, `${testCase.id}: repaired vibe still has fail issues: ${failIssues.map((issue) => issue.code).join(", ")}`);

    return {
      scene: testCase.id,
      score: Math.round(result.report.score),
      issues: result.report.issues.length,
      marker: testCase.marker,
    };
  });

  console.table(rows);
}

main();
