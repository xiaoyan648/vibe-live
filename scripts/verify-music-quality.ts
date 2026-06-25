import { buildStrudelCode } from "../src/audio/strudelCode";
import { mergeRegeneratedTarget } from "../src/ai/generate";
import { buildComposerKnowledgeContext, musicKnowledgeForTests } from "../src/ai/knowledge/musicKnowledge";
import { buildRegenerateComposerUserPrompt } from "../src/ai/prompt";
import { VIBES, type ScaleType, type Vibe, type VibePattern } from "../src/data/vibes";
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
  assert(musicKnowledgeForTests.recipes.length >= 10, "music knowledge should include at least 10 style recipes");
  assert(musicKnowledgeForTests.idioms.length >= 8, "music knowledge should include high-value Strudel idioms");

  const springKnowledge = buildComposerKnowledgeContext({
    prompt: "春日樱花下的轻盈旋律",
    moodPlan: {
      scale: "majorPentatonic",
      params: { tempo: 92 },
      name: "森林散步",
      tagline: "清晨日光和微风",
    },
  });
  assert(springKnowledge.includes("Spring pastoral ambient pop"), "spring knowledge did not retrieve pastoral recipe");
  assert(springKnowledge.includes("Strudel 安全写法 idioms"), "knowledge context is missing Strudel idioms");
  assert(springKnowledge.includes(".compressor"), "knowledge context should include safe mastering guidance");

  const neonKnowledge = buildComposerKnowledgeContext({
    prompt: "凌晨三点写代码的霓虹鼓点",
    moodPlan: {
      scale: "dorian",
      params: { tempo: 112 },
      name: "霓虹午夜",
      tagline: "键盘和玻璃幕墙",
    },
  });
  assert(neonKnowledge.includes("Neon afterhours pulse"), "neon knowledge did not retrieve afterhours recipe");

  const badMiniCode = 'stack(note("c4]").s("triangle").gain(.1)).cpm(20).analyze(1)';
  const badSwingCode = 'stack(s("hh hh hh hh").gain(.18).swingBy(.12)).cpm(20).analyze(1)';
  const badSometimesCode = 'stack(note("c4 e4 g4").s("triangle").sometimesBy(.2)).cpm(20).analyze(1)';
  const validBracketCode =
    'stack(note("<[c4 e4 g4] [f4 a4 c5]>").s("triangle").gain(.1), s("bd [sd cp]").gain(.2)).cpm(20).analyze(1)';
  const validSwingCode = 'stack(s("hh hh hh hh").gain(.18).swingBy(.12, 8)).cpm(20).analyze(1)';
  assert(!sanitizeStrudelCode(badMiniCode), "invalid Strudel mini string with unmatched ] should be rejected");
  assert(!sanitizeStrudelCode(badSwingCode), "invalid Strudel swingBy with one argument should be rejected");
  assert(!sanitizeStrudelCode(badSometimesCode), "invalid Strudel sometimesBy with one argument should be rejected");
  assert(Boolean(sanitizeStrudelCode(validBracketCode)), "valid Strudel bracket mini syntax should still be accepted");
  assert(Boolean(sanitizeStrudelCode(validSwingCode)), "valid Strudel swingBy with two arguments should still be accepted");

  const regeneratePrompt = buildRegenerateComposerUserPrompt(
    "重新调整一下，让旋律更清楚",
    { scale: "majorPentatonic", params: { tempo: 92 }, name: "原来的唱片" },
    {
      id: "old-record",
      name: "原来的唱片",
      subtitle: "Original Record",
      tagline: "原本的描述不能丢",
      visualCode: "x".repeat(20000),
      pattern: {
        root: "C",
        scale: "majorPentatonic",
        chords: ["Iadd9", "V", "vi", "IVmaj7"],
        seed: 1,
        layers: {},
        mini: { melodyMotif: "0242----" },
        strudel: { version: 1, code: 'stack(note("c5 e5 g5").s("triangle").gain(.1)).cpm(23).analyze(1)' },
      },
    },
    "full",
    springKnowledge,
  );
  assert(regeneratePrompt.includes("你正在修改“当前唱片”，不是新建唱片。"), "regenerate prompt should state edit context");
  assert(regeneratePrompt.includes("原来的唱片"), "regenerate prompt should include current record name");
  assert(regeneratePrompt.includes("c5 e5 g5"), "regenerate prompt should include current Strudel code");
  assert(!regeneratePrompt.includes("x".repeat(200)), "regenerate prompt should not be filled by visualCode");

  VIBES.forEach((vibe) => {
    const code = buildStrudelCode(vibe, vibe.params);
    const report = evaluateMusicQuality(vibe.tagline, vibe);
    const failIssues = report.issues.filter((issue) => issue.severity === "fail");
    assert(Boolean(sanitizeStrudelCode(code)), `${vibe.id}: builtin Strudel code failed sanitizer`);
    assert(/\bnote\s*\(|\bs\s*\(/.test(code), `${vibe.id}: builtin Strudel code has no playable layer`);
    assert(/\.compressor\s*\(/.test(code), `${vibe.id}: builtin Strudel code has no compressor`);
    assert(/\.postgain\s*\(/.test(code), `${vibe.id}: builtin Strudel code has no postgain`);
    assert(failIssues.length === 0, `${vibe.id}: builtin quality has fail issues: ${failIssues.map((issue) => issue.code).join(", ")}`);
  });

  const baseIdentity = makeVibe({ id: "focus", prompt: "原来的专注唱片", marker: "g4 ~ c5 ~ eb5" });
  const candidateIdentity = {
    ...makeVibe({ id: "neon", prompt: "AI 误生成的新名字", marker: "c2 ~ c2 eb2" }),
    id: "wrong-new-id",
    name: "适配调校",
    subtitle: "Wrong Generated Title",
    tagline: "适配需求的流畅舒适氛围",
    palette: { accent: "#ffffff", accent2: "#eeeeee", base: "#dddddd" },
  };
  const mergedMusic = mergeRegeneratedTarget(baseIdentity, candidateIdentity, "music");
  const mergedFull = mergeRegeneratedTarget(baseIdentity, candidateIdentity, "full");
  for (const merged of [mergedMusic, mergedFull]) {
    assert(merged.id === baseIdentity.id, "regenerate merge should preserve current record id");
    assert(merged.name === baseIdentity.name, "regenerate merge should preserve current record name");
    assert(merged.subtitle === baseIdentity.subtitle, "regenerate merge should preserve current record subtitle");
    assert(merged.tagline === baseIdentity.tagline, "regenerate merge should preserve current record tagline");
    assert(merged.palette.base === baseIdentity.palette.base, "regenerate merge should preserve current record palette");
    assert(merged.pattern?.strudel?.code === candidateIdentity.pattern?.strudel?.code, "regenerate merge should update music pattern");
  }

  const brokenNativeVibe = makeVibe({ id: "broken-native", prompt: "坏 native 代码需要降级", marker: "c2 ~ c2 eb2" });
  const repairedFallbackCode = buildStrudelCode(
    {
      ...brokenNativeVibe,
      pattern: {
        ...brokenNativeVibe.pattern!,
        strudel: {
          version: 1,
          code: badSwingCode,
          notes: "Bad native code should not be preferred.",
        },
      },
    },
    brokenNativeVibe.params,
  );
  assert(!repairedFallbackCode.includes(".swingBy(.12)"), "bad native swingBy should not remain in playable code");
  assert(Boolean(sanitizeStrudelCode(repairedFallbackCode)), "fallback code after bad native should be safe");

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
    assert(/\.compressor\s*\(/.test(code), `${testCase.id}: final Strudel code has no compressor`);
    assert(/\.postgain\s*\(/.test(code), `${testCase.id}: final Strudel code has no postgain`);
    assert(/\.noise\s*\(|orbit\(6\)/.test(code), `${testCase.id}: final Strudel code has no texture/noise bed`);
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
