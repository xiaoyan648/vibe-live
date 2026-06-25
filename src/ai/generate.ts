import { createChatCompletion, getAiConfig, type AiRequestConfig } from "./client";
import {
  buildPromptWithConversation,
  getMaxConversationMessages,
  normalizeConversationHistory,
  type ConversationTurn,
} from "./conversation";
import {
  buildComposerUserPrompt,
  buildCriticUserPrompt,
  buildMoodDirectorUserPrompt,
  buildRegenerateComposerUserPrompt,
  buildRepairPrompt,
  buildSoundDesignerUserPrompt,
  buildVisualUserPrompt,
  COMPOSER_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
  MOOD_DIRECTOR_SYSTEM_PROMPT,
  SOUND_DESIGNER_SYSTEM_PROMPT,
  VISUAL_SYSTEM_PROMPT,
} from "./prompt";
import {
  compositionPlanJsonSchema,
  criticPlanJsonSchema,
  fallbackGeneratedVibe,
  moodPlanJsonSchema,
  normalizeGeneratedVibe,
  soundDesignPlanJsonSchema,
  visualJsonSchema,
  visualOutputSchema,
} from "./schema";
import { parseModelJson, runAgentStep, type AgentModelRequest, type AgentStage } from "./agent/runner";
import { buildComposerKnowledgeContext } from "./knowledge/musicKnowledge";
import type { RegenerateTarget } from "@/data/regeneration";
import { VIBES, type Vibe } from "@/data/vibes";
import { scoreVibeDiversity } from "@/music/diversity";
import { enforceMusicQuality, evaluateMusicQuality, type MusicQualityIssue } from "@/music/quality";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";

export type GenerationStage = AgentStage;

interface GenerationOptions {
  onStage?: (stage: GenerationStage) => void;
  conversationHistory?: ConversationTurn[];
  maxConversationMessages?: number;
  aiConfig?: AiRequestConfig;
}

const COMPOSER_CANDIDATE_COUNT = 3;
const COMPOSER_CANDIDATE_DIRECTIONS = [
  "候选 A：旋律前景最重要。写出清楚、可哼唱、和场景一致的 motif，避免背景铺底抢戏。",
  "候选 B：groove 最重要。鼓组、低音与 arp 要形成成熟律动，但仍保持层次和留白。",
  "候选 C：质感与差异最重要。保留细节、克制 ambience 和 pad 厚度，并主动避开默认唱片的节奏、和弦色彩和主音色。",
];

function pushStage(stages: GenerationStage[], stage: GenerationStage, options?: GenerationOptions) {
  stages.push(stage);
  options?.onStage?.(stage);
}

function buildAgentPrompt(prompt: string, options?: GenerationOptions) {
  const maxMessages = Math.min(getMaxConversationMessages(), getMaxConversationMessages(options?.maxConversationMessages));
  const history = normalizeConversationHistory(options?.conversationHistory, maxMessages);
  return buildPromptWithConversation(prompt, history);
}

async function requestStructuredJson({
  system,
  user,
  jsonSchema,
  temperature,
  maxTokens,
  aiConfig,
}: {
  system: string;
  user: string;
  jsonSchema: ResponseFormatJSONSchema.JSONSchema;
  temperature: number;
  maxTokens: number;
  aiConfig?: AiRequestConfig;
}) {
  const { model } = getAiConfig(aiConfig);

  if (!model) {
    throw new Error("Missing OPENAI_MODEL or ARK_MODEL");
  }

  const completion = await createChatCompletion(aiConfig, {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: jsonSchema,
    },
  });

  return completion.choices?.[0]?.message?.content ?? "";
}

async function requestVisualCode(prompt: string, musicBlueprint: Vibe, repair?: { rawOutput: string; error: string }) {
  return requestStructuredJson({
    system: VISUAL_SYSTEM_PROMPT,
    user: repair ? buildRepairPrompt(prompt, repair.rawOutput, repair.error) : buildVisualUserPrompt(prompt, musicBlueprint),
    jsonSchema: visualJsonSchema,
    temperature: repair ? 0.25 : 0.72,
    maxTokens: 5200,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeMusicBlueprint(input: unknown) {
  const record = input && typeof input === "object" ? input : {};
  return normalizeGeneratedVibe({ ...record, visualCode: "" });
}

function normalizeVisualOutput(input: unknown) {
  return visualOutputSchema.parse(input).visualCode;
}

function composeDraftBlueprint(moodPlan: unknown, compositionPlan: unknown, soundDesignPlan: unknown) {
  const mood = asRecord(moodPlan);
  const composition = asRecord(compositionPlan);
  const sound = asRecord(soundDesignPlan);

  return {
    id: mood.id,
    name: mood.name,
    subtitle: mood.subtitle,
    tagline: mood.tagline,
    glyph: mood.glyph,
    visual: mood.visual,
    palette: mood.palette,
    params: sound.params ?? mood.params,
    pattern: {
      root: mood.root,
      scale: mood.scale,
      chords: composition.chords,
      seed: mood.seed,
      layers: sound.layers,
      mini: composition.mini,
      strudel: composition.strudel,
      arrangement: composition.arrangement,
    },
    visualCode: "",
  };
}

function provisionalSoundDesignPlan(moodPlan: unknown) {
  const mood = asRecord(moodPlan);
  const params = asRecord(mood.params);
  const energy = typeof params.energy === "number" ? params.energy : 0.45;
  const density = typeof params.density === "number" ? params.density : 0.42;
  const ambience = typeof params.ambience === "number" ? params.ambience : 0.28;

  return {
    params: mood.params,
    layers: {
      drums: { enabled: energy > 0.24, density: Math.min(0.74, Math.max(0.18, density + energy * 0.12)), swing: 0.08, octave: 3 },
      bass: { enabled: true, density: Math.min(0.68, Math.max(0.24, density)), swing: 0.06, octave: 2 },
      pad: { enabled: true, density: Math.min(0.54, Math.max(0.2, ambience + 0.12)), swing: 0.03, octave: 4 },
      melody: { enabled: true, density: Math.min(0.72, Math.max(0.34, density + 0.08)), swing: 0.05, octave: 5 },
      arp: { enabled: density > 0.28, density: Math.min(0.76, Math.max(0.26, density + 0.12)), swing: 0.05, octave: 5 },
    },
  };
}

function moodPlanFromVibe(vibe: Vibe) {
  return {
    id: vibe.id,
    name: vibe.name,
    subtitle: vibe.subtitle,
    tagline: vibe.tagline,
    glyph: vibe.glyph,
    visual: vibe.visual,
    palette: vibe.palette,
    params: vibe.params,
    root: vibe.pattern?.root ?? "C",
    scale: vibe.pattern?.scale ?? "minorPentatonic",
    seed: (vibe.pattern?.seed ?? vibe.id.length * 97) + 1,
  };
}

function extractCriticBlueprint(criticPlan: unknown, fallbackBlueprint: unknown) {
  const critic = asRecord(criticPlan);
  return normalizeMusicBlueprint(critic.blueprint ?? fallbackBlueprint);
}

function applyQualityGate(prompt: string, vibe: Vibe, stages: GenerationStage[], options?: GenerationOptions) {
  const quality = enforceMusicQuality(prompt, vibe);
  pushStage(
    stages,
    {
      id: "quality",
      label: quality.report.repaired
        ? `音乐质量校验 · 已修复 ${quality.report.issues.length} 项`
        : `音乐质量校验 · ${quality.report.score}`,
      status: quality.report.repaired ? "repaired" : "completed",
    },
    options,
  );

  return quality.vibe;
}

type ComposerCandidate = {
  index: number;
  direction: string;
  output: unknown;
  score: number;
  failCount: number;
  warnCount: number;
  issues: MusicQualityIssue[];
  diversityScore: number;
  nearestReference?: string;
};

function summarizeComposerIssues(issues: MusicQualityIssue[]) {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.severity}:${issue.code} ${issue.message}`)
    .join("；");
}

function scoreComposerCandidate({
  index,
  direction,
  output,
  moodPlan,
  prompt,
}: {
  index: number;
  direction: string;
  output: unknown;
  moodPlan: unknown;
  prompt: string;
}): ComposerCandidate {
  const draft = composeDraftBlueprint(moodPlan, output, provisionalSoundDesignPlan(moodPlan));
  const vibe = normalizeMusicBlueprint(draft);
  const report = evaluateMusicQuality(prompt, vibe);
  const diversity = scoreVibeDiversity(vibe, VIBES);
  const diversityIssues: MusicQualityIssue[] =
    diversity.score < 46
      ? [
          {
            code: "low-diversity",
            severity: "warn",
            message: `候选和 ${diversity.nearestId ?? "默认唱片"} 过近，需改节奏、和弦、motif 或音色。`,
          },
        ]
      : [];
  const score = Math.round(report.score * 0.82 + diversity.score * 0.18);

  return {
    index,
    direction,
    output,
    score,
    failCount: report.issues.filter((issue) => issue.severity === "fail").length,
    warnCount: report.issues.filter((issue) => issue.severity === "warn").length + diversityIssues.length,
    issues: [...report.issues, ...diversityIssues],
    diversityScore: diversity.score,
    nearestReference: diversity.nearestId,
  };
}

async function runMusicReActComposer({
  prompt,
  moodPlan,
  request,
  stages,
  options,
  currentVibe,
  target,
}: {
  prompt: string;
  moodPlan: unknown;
  request: (request: AgentModelRequest) => Promise<string>;
  stages: GenerationStage[];
  options?: GenerationOptions;
  currentVibe?: Vibe;
  target?: RegenerateTarget;
}) {
  const composerStep = {
    id: "composer",
    label: "Composer",
    system: COMPOSER_SYSTEM_PROMPT,
    jsonSchema: compositionPlanJsonSchema,
    temperature: 0.82,
    maxTokens: 1900,
    buildUserPrompt: (input: {
      prompt: string;
      moodPlan: unknown;
      direction: string;
      knowledgeContext: string;
      currentVibe?: Vibe;
      target?: RegenerateTarget;
    }) => {
      const directedPrompt = `${input.prompt}\n\n${input.direction}`;
      return input.currentVibe && input.target
        ? buildRegenerateComposerUserPrompt(
            directedPrompt,
            input.moodPlan,
            input.currentVibe,
            input.target,
            input.knowledgeContext,
          )
        : buildComposerUserPrompt(directedPrompt, input.moodPlan, input.knowledgeContext);
    },
    parse: (rawJson: unknown) => rawJson,
  };

  const directions = COMPOSER_CANDIDATE_DIRECTIONS.slice(0, COMPOSER_CANDIDATE_COUNT);
  const knowledgeContext = buildComposerKnowledgeContext({ prompt, moodPlan, currentVibe, target });
  pushStage(
    stages,
    {
      id: "react-plan",
      label: target ? `ReAct 编曲 · 知识库规划 ${target}` : "ReAct 编曲 · 知识库规划候选",
      status: "completed",
    },
    options,
  );

  const settled = await Promise.allSettled(
    directions.map((direction, index) =>
      runAgentStep(
        { ...composerStep, temperature: 0.72 + index * 0.08 },
        { prompt, moodPlan, direction, knowledgeContext, currentVibe, target },
        request,
      ),
    ),
  );

  const candidates = settled
    .map((result, index) => {
      if (result.status !== "fulfilled") return null;
      try {
        return scoreComposerCandidate({
          index,
          direction: directions[index] ?? "",
          output: result.value.output,
          moodPlan,
          prompt,
        });
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.failCount - b.failCount || a.warnCount - b.warnCount);

  if (!candidates.length) {
    throw new Error("ReAct composer candidates all failed");
  }

  let selected = candidates[0];
  pushStage(
    stages,
    {
      id: "react-observe",
      label: `ReAct 编曲 · 观察候选 · 最佳 ${selected.score} / 差异 ${selected.diversityScore}`,
      status: candidates.length < COMPOSER_CANDIDATE_COUNT ? "repaired" : "completed",
    },
    options,
  );

  if (selected.failCount > 0 || selected.score < 78) {
    const repairDirection = [
      "ReAct 修复：保留候选里最匹配场景的方向，但必须修复观察到的音乐质量问题。",
      "优先补足可记忆旋律、低音运动、groove 层次、场景明暗匹配、安全原生 Strudel、编曲计划和候选差异度。",
      `Observation：${summarizeComposerIssues(selected.issues) || "score below threshold"}`,
    ].join("\n");

    try {
      const repairStep = await runAgentStep(
        { ...composerStep, temperature: 0.66 },
        { prompt, moodPlan, direction: repairDirection, knowledgeContext, currentVibe, target },
        request,
      );
      const repaired = scoreComposerCandidate({
        index: candidates.length,
        direction: repairDirection,
        output: repairStep.output,
        moodPlan,
        prompt,
      });
      const acceptedRepair = repaired.score > selected.score || repaired.failCount < selected.failCount;

      if (acceptedRepair) {
        selected = repaired;
      }

      pushStage(
        stages,
        {
          id: "react-repair",
          label: `ReAct 编曲 · 修复候选 · ${repaired.score}`,
          status: acceptedRepair ? "repaired" : "completed",
        },
        options,
      );
    } catch {
      pushStage(stages, { id: "react-repair", label: "ReAct 编曲 · 修复候选", status: "fallback" }, options);
    }
  }

  pushStage(
    stages,
    {
      id: "react-finish",
      label: `ReAct 编曲 · 选中 ${selected.index + 1}/${Math.max(COMPOSER_CANDIDATE_COUNT, selected.index + 1)} · ${selected.score}`,
      status: selected.failCount > 0 ? "repaired" : "completed",
    },
    options,
  );

  return selected.output;
}

export function mergeRegeneratedTarget(baseVibe: Vibe, candidate: Vibe, target: RegenerateTarget): Vibe {
  if (target === "music" || target === "full") {
    return {
      ...baseVibe,
      params: candidate.params,
      pattern: candidate.pattern ?? baseVibe.pattern,
      visualCode: baseVibe.visualCode,
      artwork: baseVibe.artwork,
      musicQuality: candidate.musicQuality,
      source: "ai",
    };
  }

  if (target === "visual") {
    return baseVibe;
  }

  const basePattern = baseVibe.pattern;
  const candidatePattern = candidate.pattern;

  if (!basePattern || !candidatePattern) {
    return candidate;
  }

  const nextPattern = {
    ...basePattern,
    seed: candidatePattern.seed,
    strudel: candidatePattern.strudel,
    arrangement: candidatePattern.arrangement ?? basePattern.arrangement,
    mini: {
      ...basePattern.mini,
      drums: { ...basePattern.mini?.drums },
    },
    layers: {
      ...basePattern.layers,
    },
  };

  if (target === "drums") {
    nextPattern.mini.drums = candidatePattern.mini?.drums ?? nextPattern.mini.drums;
    nextPattern.layers.drums = candidatePattern.layers.drums;
  }

  if (target === "bass") {
    nextPattern.mini.bassline = candidatePattern.mini?.bassline ?? nextPattern.mini.bassline;
    nextPattern.layers.bass = candidatePattern.layers.bass;
  }

  if (target === "melody") {
    nextPattern.mini.melodyMotif = candidatePattern.mini?.melodyMotif ?? nextPattern.mini.melodyMotif;
    nextPattern.layers.melody = candidatePattern.layers.melody;
  }

  if (target === "arp") {
    nextPattern.mini.arpPattern = candidatePattern.mini?.arpPattern ?? nextPattern.mini.arpPattern;
    nextPattern.layers.arp = candidatePattern.layers.arp;
  }

  if (target === "pad") {
    nextPattern.chords = candidatePattern.chords;
    nextPattern.layers.pad = candidatePattern.layers.pad;
  }

  return {
    ...baseVibe,
    params: {
      ...baseVibe.params,
      tempo: candidate.params.tempo,
      density: candidate.params.density,
      energy: target === "drums" ? candidate.params.energy : baseVibe.params.energy,
      space: target === "pad" ? candidate.params.space : baseVibe.params.space,
    },
    pattern: nextPattern,
    source: "ai",
  };
}

export async function generateVibeFromPrompt(
  prompt: string,
  options?: GenerationOptions,
): Promise<{ vibe: Vibe; repaired: boolean; fallback: boolean; stages: GenerationStage[] }> {
  const stages: GenerationStage[] = [];
  const agentPrompt = buildAgentPrompt(prompt, options);

  try {
    const request = (body: AgentModelRequest) => requestStructuredJson({ ...body, aiConfig: options?.aiConfig });

    const moodStep = await runAgentStep(
      {
        id: "mood",
        label: "Mood Director",
        system: MOOD_DIRECTOR_SYSTEM_PROMPT,
        jsonSchema: moodPlanJsonSchema,
        temperature: 0.72,
        maxTokens: 1700,
        buildUserPrompt: buildMoodDirectorUserPrompt,
        parse: (rawJson) => rawJson,
      },
      agentPrompt,
      request,
    );
    pushStage(stages, moodStep.stage, options);

    const compositionPlan = await runMusicReActComposer({
      prompt: agentPrompt,
      moodPlan: moodStep.output,
      request,
      stages,
      options,
    });

    const soundStep = await runAgentStep(
      {
        id: "sound",
        label: "Sound Designer",
        system: SOUND_DESIGNER_SYSTEM_PROMPT,
        jsonSchema: soundDesignPlanJsonSchema,
        temperature: 0.58,
        maxTokens: 1600,
        buildUserPrompt: (input: { prompt: string; moodPlan: unknown; compositionPlan: unknown }) =>
          buildSoundDesignerUserPrompt(input.prompt, input.moodPlan, input.compositionPlan),
        parse: (rawJson) => rawJson,
      },
      { prompt: agentPrompt, moodPlan: moodStep.output, compositionPlan },
      request,
    );
    pushStage(stages, soundStep.stage, options);

    const draftBlueprint = composeDraftBlueprint(moodStep.output, compositionPlan, soundStep.output);

    let musicBlueprint: Vibe;
    try {
      const criticStep = await runAgentStep(
        {
          id: "critic",
          label: "Critic / Repair",
          system: CRITIC_SYSTEM_PROMPT,
          jsonSchema: criticPlanJsonSchema,
          temperature: 0.24,
          maxTokens: 3200,
          buildUserPrompt: (input: {
            prompt: string;
            moodPlan: unknown;
            compositionPlan: unknown;
            soundDesignPlan: unknown;
            draftBlueprint: unknown;
          }) =>
            buildCriticUserPrompt(
              input.prompt,
              input.moodPlan,
              input.compositionPlan,
              input.soundDesignPlan,
              input.draftBlueprint,
            ),
          parse: (rawJson) => rawJson,
        },
        {
          prompt: agentPrompt,
          moodPlan: moodStep.output,
          compositionPlan,
          soundDesignPlan: soundStep.output,
          draftBlueprint,
        },
        request,
      );
      musicBlueprint = extractCriticBlueprint(criticStep.output, draftBlueprint);
      pushStage(stages, criticStep.stage, options);
    } catch {
      musicBlueprint = normalizeMusicBlueprint(draftBlueprint);
      pushStage(stages, { id: "critic", label: "Critic / Repair", status: "fallback" }, options);
    }

    musicBlueprint = applyQualityGate(agentPrompt, musicBlueprint, stages, options);

    let visualCode = "";
    let rawVisualOutput = "";

    try {
      rawVisualOutput = await requestVisualCode(agentPrompt, musicBlueprint);
      visualCode = normalizeVisualOutput(parseModelJson(rawVisualOutput));
      pushStage(stages, { id: "visual", label: "动态视觉", status: "completed" }, options);
    } catch (visualError) {
      const message = visualError instanceof Error ? visualError.message : String(visualError);
      if (rawVisualOutput) {
        try {
          const repairedVisualOutput = await requestVisualCode(agentPrompt, musicBlueprint, {
            rawOutput: rawVisualOutput,
            error: message,
          });
          visualCode = normalizeVisualOutput(parseModelJson(repairedVisualOutput));
          pushStage(stages, { id: "visual", label: "动态视觉", status: "repaired" }, options);
        } catch {
          pushStage(stages, { id: "visual", label: "动态视觉", status: "fallback" }, options);
        }
      } else {
        pushStage(stages, { id: "visual", label: "动态视觉", status: "fallback" }, options);
      }
    }

    pushStage(stages, { id: "compose", label: "合成 Vibe", status: "completed" }, options);

    return {
      vibe: { ...musicBlueprint, visualCode, source: "ai" },
      repaired: stages.some((stage) => stage.status === "repaired"),
      fallback: false,
      stages,
    };
  } catch (error) {
    pushStage(stages, { id: "agent", label: "轻量 Agent", status: "fallback" }, options);
    const fallbackVibe = applyQualityGate(agentPrompt, fallbackGeneratedVibe(prompt), stages, options);
    return {
      vibe: fallbackVibe,
      repaired: stages.some((stage) => stage.status === "repaired"),
      fallback: true,
      stages,
    };
  }
}

export async function regenerateVibeFromPrompt(
  prompt: string,
  baseVibeInput: unknown,
  target: RegenerateTarget = "music",
  options?: GenerationOptions,
): Promise<{ vibe: Vibe; repaired: boolean; fallback: boolean; stages: GenerationStage[] }> {
  const baseVibe = normalizeGeneratedVibe(baseVibeInput);
  const agentPrompt = buildAgentPrompt(prompt, options);

  const stages: GenerationStage[] = [];

  if (target === "visual") {
    let visualCode = "";
    let rawVisualOutput = "";

    try {
      rawVisualOutput = await requestVisualCode(agentPrompt, baseVibe);
      visualCode = normalizeVisualOutput(parseModelJson(rawVisualOutput));
      pushStage(stages, { id: "visual", label: "动态视觉", status: "completed" }, options);
    } catch (visualError) {
      const message = visualError instanceof Error ? visualError.message : String(visualError);
      if (rawVisualOutput) {
        try {
          const repairedVisualOutput = await requestVisualCode(agentPrompt, baseVibe, {
            rawOutput: rawVisualOutput,
            error: message,
          });
          visualCode = normalizeVisualOutput(parseModelJson(repairedVisualOutput));
          pushStage(stages, { id: "visual", label: "动态视觉", status: "repaired" }, options);
        } catch {
          pushStage(stages, { id: "visual", label: "动态视觉", status: "fallback" }, options);
        }
      } else {
        pushStage(stages, { id: "visual", label: "动态视觉", status: "fallback" }, options);
      }
    }

    return {
      vibe: { ...baseVibe, visualCode: visualCode || baseVibe.visualCode, source: "ai" },
      repaired: stages.some((stage) => stage.status === "repaired"),
      fallback: stages.some((stage) => stage.status === "fallback"),
      stages,
    };
  }

  try {
    const request = (body: AgentModelRequest) => requestStructuredJson({ ...body, aiConfig: options?.aiConfig });
    const moodPlan = moodPlanFromVibe(baseVibe);
    pushStage(stages, { id: "mood", label: "Mood Director", status: "completed" }, options);

    const compositionPlan = await runMusicReActComposer({
      prompt: agentPrompt,
      moodPlan,
      request,
      stages,
      options,
      currentVibe: baseVibe,
      target,
    });

    const soundStep = await runAgentStep(
      {
        id: "sound",
        label: "Sound Designer",
        system: SOUND_DESIGNER_SYSTEM_PROMPT,
        jsonSchema: soundDesignPlanJsonSchema,
        temperature: 0.5,
        maxTokens: 1600,
        buildUserPrompt: (input: { prompt: string; moodPlan: unknown; compositionPlan: unknown }) =>
          buildSoundDesignerUserPrompt(input.prompt, input.moodPlan, input.compositionPlan),
        parse: (rawJson) => rawJson,
      },
      { prompt: agentPrompt, moodPlan, compositionPlan },
      request,
    );
    pushStage(stages, soundStep.stage, options);

    const draftBlueprint = {
      ...composeDraftBlueprint(moodPlan, compositionPlan, soundStep.output),
      id: baseVibe.id,
      name: baseVibe.name,
      subtitle: baseVibe.subtitle,
      tagline: baseVibe.tagline,
      glyph: baseVibe.glyph,
      visual: baseVibe.visual,
      palette: baseVibe.palette,
      visualCode: "",
    };

    let musicBlueprint: Vibe;
    try {
      const criticStep = await runAgentStep(
        {
          id: "critic",
          label: "Critic / Repair",
          system: CRITIC_SYSTEM_PROMPT,
          jsonSchema: criticPlanJsonSchema,
          temperature: 0.2,
          maxTokens: 3200,
          buildUserPrompt: (input: {
            prompt: string;
            moodPlan: unknown;
            compositionPlan: unknown;
            soundDesignPlan: unknown;
            draftBlueprint: unknown;
          }) =>
            buildCriticUserPrompt(
              input.prompt,
              input.moodPlan,
              input.compositionPlan,
              input.soundDesignPlan,
              input.draftBlueprint,
            ),
          parse: (rawJson) => rawJson,
        },
        {
          prompt: agentPrompt,
          moodPlan,
          compositionPlan,
          soundDesignPlan: soundStep.output,
          draftBlueprint,
        },
        request,
      );
      musicBlueprint = extractCriticBlueprint(criticStep.output, draftBlueprint);
      pushStage(stages, criticStep.stage, options);
    } catch {
      musicBlueprint = normalizeMusicBlueprint(draftBlueprint);
      pushStage(stages, { id: "critic", label: "Critic / Repair", status: "fallback" }, options);
    }

    pushStage(stages, { id: "compose", label: "合成 Vibe", status: "completed" }, options);

    const mergedVibe = mergeRegeneratedTarget(baseVibe, musicBlueprint, target);
    const qualityVibe = applyQualityGate(agentPrompt, mergedVibe, stages, options);

    return {
      vibe: qualityVibe,
      repaired: stages.some((stage) => stage.status === "repaired"),
      fallback: false,
      stages,
    };
  } catch {
    pushStage(stages, { id: "agent", label: "局部再生成", status: "fallback" }, options);
    return {
      vibe: baseVibe,
      repaired: false,
      fallback: true,
      stages,
    };
  }
}
