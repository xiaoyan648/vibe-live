import { createOpenAIClient, getAiConfig } from "./client";
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
import type { RegenerateTarget } from "@/data/regeneration";
import type { Vibe } from "@/data/vibes";
import { enforceMusicQuality, evaluateMusicQuality } from "@/music/quality";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";

export type GenerationStage = AgentStage;

interface GenerationOptions {
  onStage?: (stage: GenerationStage) => void;
}

const COMPOSER_CANDIDATE_COUNT = 3;
const COMPOSER_CANDIDATE_DIRECTIONS = [
  "候选 A：旋律前景最重要。写出清楚、可哼唱、和场景一致的 motif，避免背景铺底抢戏。",
  "候选 B：groove 最重要。鼓组、低音与 arp 要形成成熟律动，但仍保持层次和留白。",
  "候选 C：质感与空间最重要。保留细节、克制 ambience 和 pad 厚度，避免嗡嗡 drone。",
];

function pushStage(stages: GenerationStage[], stage: GenerationStage, options?: GenerationOptions) {
  stages.push(stage);
  options?.onStage?.(stage);
}

async function requestStructuredJson({
  system,
  user,
  jsonSchema,
  temperature,
  maxTokens,
}: {
  system: string;
  user: string;
  jsonSchema: ResponseFormatJSONSchema.JSONSchema;
  temperature: number;
  maxTokens: number;
}) {
  const client = createOpenAIClient();
  const { model } = getAiConfig();

  if (!model) {
    throw new Error("Missing ARK_MODEL");
  }

  const completion = await client.chat.completions.create({
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

  return completion.choices[0]?.message?.content ?? "";
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

async function runComposerCandidates({
  prompt,
  moodPlan,
  request,
  stages,
  options,
}: {
  prompt: string;
  moodPlan: unknown;
  request: (request: AgentModelRequest) => Promise<string>;
  stages: GenerationStage[];
  options?: GenerationOptions;
}) {
  const composerStep = {
    id: "composer",
    label: "Composer",
    system: COMPOSER_SYSTEM_PROMPT,
    jsonSchema: compositionPlanJsonSchema,
    temperature: 0.82,
    maxTokens: 1900,
    buildUserPrompt: (input: { prompt: string; moodPlan: unknown; direction: string }) =>
      buildComposerUserPrompt(`${input.prompt}\n\n${input.direction}`, input.moodPlan),
    parse: (rawJson: unknown) => rawJson,
  };

  const settled = await Promise.allSettled(
    COMPOSER_CANDIDATE_DIRECTIONS.slice(0, COMPOSER_CANDIDATE_COUNT).map((direction, index) =>
      runAgentStep(
        { ...composerStep, temperature: 0.72 + index * 0.08 },
        { prompt, moodPlan, direction },
        request,
      ),
    ),
  );

  const provisionalSound = provisionalSoundDesignPlan(moodPlan);
  const candidates = settled
    .map((result, index) => {
      if (result.status !== "fulfilled") return null;
      try {
        const draft = composeDraftBlueprint(moodPlan, result.value.output, provisionalSound);
        const vibe = normalizeMusicBlueprint(draft);
        const report = evaluateMusicQuality(prompt, vibe);
        return {
          index,
          output: result.value.output,
          score: report.score,
          failCount: report.issues.filter((issue) => issue.severity === "fail").length,
          warnCount: report.issues.filter((issue) => issue.severity === "warn").length,
        };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.failCount - b.failCount || a.warnCount - b.warnCount);

  if (!candidates.length) {
    throw new Error("Composer candidates all failed");
  }

  const selected = candidates[0];
  pushStage(
    stages,
    {
      id: "composer",
      label: `候选作曲 · 选中 ${selected.index + 1}/${COMPOSER_CANDIDATE_COUNT} · ${selected.score}`,
      status: candidates.length < COMPOSER_CANDIDATE_COUNT ? "repaired" : "completed",
    },
    options,
  );

  return selected.output;
}

function mergeRegeneratedTarget(baseVibe: Vibe, candidate: Vibe, target: RegenerateTarget): Vibe {
  if (target === "music" || target === "full") {
    return { ...candidate, visualCode: baseVibe.visualCode, source: "ai" };
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

  try {
    const request = (body: AgentModelRequest) => requestStructuredJson(body);

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
      prompt,
      request,
    );
    pushStage(stages, moodStep.stage, options);

    const compositionPlan = await runComposerCandidates({
      prompt,
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
      { prompt, moodPlan: moodStep.output, compositionPlan },
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
          prompt,
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

    musicBlueprint = applyQualityGate(prompt, musicBlueprint, stages, options);

    let visualCode = "";
    let rawVisualOutput = "";

    try {
      rawVisualOutput = await requestVisualCode(prompt, musicBlueprint);
      visualCode = normalizeVisualOutput(parseModelJson(rawVisualOutput));
      pushStage(stages, { id: "visual", label: "动态视觉", status: "completed" }, options);
    } catch (visualError) {
      const message = visualError instanceof Error ? visualError.message : String(visualError);
      if (rawVisualOutput) {
        try {
          const repairedVisualOutput = await requestVisualCode(prompt, musicBlueprint, {
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
    const fallbackVibe = applyQualityGate(prompt, fallbackGeneratedVibe(prompt), stages, options);
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
): Promise<{ vibe: Vibe; repaired: boolean; fallback: boolean; stages: GenerationStage[] }> {
  const baseVibe = normalizeGeneratedVibe(baseVibeInput);

  if (target === "full") {
    return generateVibeFromPrompt(prompt);
  }

  const stages: GenerationStage[] = [];

  if (target === "visual") {
    let visualCode = "";
    let rawVisualOutput = "";

    try {
      rawVisualOutput = await requestVisualCode(prompt, baseVibe);
      visualCode = normalizeVisualOutput(parseModelJson(rawVisualOutput));
      stages.push({ id: "visual", label: "动态视觉", status: "completed" });
    } catch (visualError) {
      const message = visualError instanceof Error ? visualError.message : String(visualError);
      if (rawVisualOutput) {
        try {
          const repairedVisualOutput = await requestVisualCode(prompt, baseVibe, {
            rawOutput: rawVisualOutput,
            error: message,
          });
          visualCode = normalizeVisualOutput(parseModelJson(repairedVisualOutput));
          stages.push({ id: "visual", label: "动态视觉", status: "repaired" });
        } catch {
          stages.push({ id: "visual", label: "动态视觉", status: "fallback" });
        }
      } else {
        stages.push({ id: "visual", label: "动态视觉", status: "fallback" });
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
    const request = (body: AgentModelRequest) => requestStructuredJson(body);
    const moodPlan = moodPlanFromVibe(baseVibe);
    stages.push({ id: "mood", label: "Mood Director", status: "completed" });

    const compositionStep = await runAgentStep(
      {
        id: "composer",
        label: "Composer",
        system: COMPOSER_SYSTEM_PROMPT,
        jsonSchema: compositionPlanJsonSchema,
        temperature: 0.74,
        maxTokens: 1700,
        buildUserPrompt: (input: { prompt: string; moodPlan: unknown; currentVibe: unknown; target: RegenerateTarget }) =>
          buildRegenerateComposerUserPrompt(input.prompt, input.moodPlan, input.currentVibe, input.target),
        parse: (rawJson) => rawJson,
      },
      { prompt, moodPlan, currentVibe: baseVibe, target },
      request,
    );
    stages.push(compositionStep.stage);

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
      { prompt, moodPlan, compositionPlan: compositionStep.output },
      request,
    );
    stages.push(soundStep.stage);

    const draftBlueprint = {
      ...composeDraftBlueprint(moodPlan, compositionStep.output, soundStep.output),
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
          prompt,
          moodPlan,
          compositionPlan: compositionStep.output,
          soundDesignPlan: soundStep.output,
          draftBlueprint,
        },
        request,
      );
      musicBlueprint = extractCriticBlueprint(criticStep.output, draftBlueprint);
      stages.push(criticStep.stage);
    } catch {
      musicBlueprint = normalizeMusicBlueprint(draftBlueprint);
      stages.push({ id: "critic", label: "Critic / Repair", status: "fallback" });
    }

    stages.push({ id: "compose", label: "合成 Vibe", status: "completed" });

    const mergedVibe = mergeRegeneratedTarget(baseVibe, musicBlueprint, target);
    const qualityVibe = applyQualityGate(prompt, mergedVibe, stages);

    return {
      vibe: qualityVibe,
      repaired: stages.some((stage) => stage.status === "repaired"),
      fallback: false,
      stages,
    };
  } catch {
    stages.push({ id: "agent", label: "局部再生成", status: "fallback" });
    return {
      vibe: baseVibe,
      repaired: false,
      fallback: true,
      stages,
    };
  }
}
