import { z } from "zod";
import {
  VIBES,
  type ArrangementRoleType,
  type LayerType,
  type ScaleType,
  type Vibe,
  type VisualType,
} from "@/data/vibes";
import { NOTE_ROOTS, ROMAN_CHORD_SYMBOLS, normalizeChordProgression, normalizeRootNote } from "@/music/chords";
import { sanitizeStrudelCode } from "@/music/strudelSafety";

const VISUAL_TYPES = ["orbs", "rain", "particles", "waves", "cosmos"] as const;
const SCALE_TYPES = ["major", "minor", "minorPentatonic", "majorPentatonic", "dorian", "lydian"] as const;
const LAYER_TYPES = ["drums", "bass", "pad", "melody", "arp"] as const;
const ARRANGEMENT_ROLES = ["ambience", "drums", "bass", "chords", "motif", "countermelody", "transition"] as const;

const hexColor = /^#[0-9a-fA-F]{6}$/;

const rawLayerSchema = z.object({
  enabled: z.boolean().catch(true),
  density: z.coerce.number().catch(0.4),
  swing: z.coerce.number().catch(0.06),
  octave: z.coerce.number().optional(),
});

const rawMiniSchema = z.object({
  drums: z
    .object({
      kick: z.string().catch("x---x---x---x---"),
      snare: z.string().catch("----x-------x---"),
      hat: z.string().catch("x-x-x-x-x-x-x-x-"),
      percussion: z.string().catch("----------------"),
    })
    .catch({
      kick: "x---x---x---x---",
      snare: "----x-------x---",
      hat: "x-x-x-x-x-x-x-x-",
      percussion: "----------------",
    }),
  bassline: z.string().catch("0---0---4---3---"),
  melodyMotif: z.string().catch("0-2-4---2---0---"),
  arpPattern: z.string().catch("02420242--------"),
});

const rawStrudelSchema = z.object({
  version: z.literal(1).catch(1),
  code: z.string().max(5200).catch(""),
  notes: z.string().max(240).optional().catch(undefined),
});

const rawArrangementRoleSchema = z.object({
  role: z.enum(ARRANGEMENT_ROLES).catch("motif"),
  instrument: z.string().min(1).max(80).catch("triangle synth"),
  purpose: z.string().min(1).max(120).catch("支撑场景氛围。"),
  pattern: z.string().min(1).max(120).catch("16 step loop with space."),
  register: z.enum(["low", "mid", "high", "wide"]).catch("mid"),
  gain: z.coerce.number().catch(0.2),
  motion: z.enum(["static", "slow", "pulse", "syncopated", "sparkle"]).catch("slow"),
});

const rawArrangementSchema = z.object({
  form: z.string().min(1).max(160).catch("8-bar loop with subtle A/B variation."),
  keyMood: z.string().min(1).max(160).catch("scene-matched tonal center."),
  chordPalette: z.string().min(1).max(160).catch("four-chord palette with restrained voicings."),
  roles: z.array(rawArrangementRoleSchema).min(3).max(7).catch([]),
  mix: z
    .object({
      masterGain: z.coerce.number().catch(0.82),
      peakCeilingDb: z.coerce.number().catch(-1),
      ambienceGain: z.coerce.number().catch(0.02),
      foreground: z.string().min(1).max(80).catch("melody motif"),
      notes: z.string().min(1).max(180).catch("Keep ambience below the foreground."),
    })
    .catch({
      masterGain: 0.82,
      peakCeilingDb: -1,
      ambienceGain: 0.02,
      foreground: "melody motif",
      notes: "Keep ambience below the foreground.",
    }),
});

const rawMusicQualitySchema = z.object({
  score: z.coerce.number().catch(0),
  repaired: z.boolean().catch(false),
  issues: z
    .array(
      z.object({
        code: z.string().max(80).catch("quality"),
        severity: z.enum(["warn", "fail"]).catch("warn"),
        message: z.string().max(180).catch("音乐质量提示。"),
      }),
    )
    .catch([]),
});

const rawArtworkSchema = z.object({
  imageUrl: z.string().url().catch(""),
  prompt: z.string().max(2400).catch(""),
  model: z.string().max(120).catch(""),
  createdAt: z.string().max(48).catch(""),
});

const rawPatternSchema = z.object({
  root: z.string().min(1).catch("C"),
  scale: z.enum(SCALE_TYPES).catch("minorPentatonic"),
  chords: z.array(z.string()).min(1).catch(["i", "VI", "III", "VII"]),
  seed: z.coerce.number().int().catch(1337),
  layers: z.object({
    drums: rawLayerSchema,
    bass: rawLayerSchema,
    pad: rawLayerSchema,
    melody: rawLayerSchema,
    arp: rawLayerSchema,
  }),
  mini: rawMiniSchema.optional(),
  strudel: rawStrudelSchema.optional(),
  arrangement: rawArrangementSchema.optional(),
});

export const generatedVibeSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(48)
    .transform((value) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48),
    )
    .catch("ai-vibe"),
  name: z.string().min(1).max(24).catch("自制氛围"),
  subtitle: z.string().min(1).max(48).catch("AI Vibe"),
  tagline: z.string().min(1).max(96).catch("一段由 AI 生成的声音与光。"),
  glyph: z.string().min(1).max(4).catch("✦"),
  visual: z.enum(VISUAL_TYPES).catch("particles"),
  palette: z.object({
    accent: z.string().regex(hexColor).catch("#8b5cf6"),
    accent2: z.string().regex(hexColor).catch("#22d3ee"),
    base: z.string().regex(hexColor).catch("#070812"),
  }),
  params: z.object({
    energy: z.coerce.number().catch(0.45),
    warmth: z.coerce.number().catch(0.55),
    space: z.coerce.number().catch(0.72),
    brightness: z.coerce.number().catch(0.58),
    ambience: z.coerce.number().catch(0.45),
    density: z.coerce.number().catch(0.42),
    tempo: z.coerce.number().catch(76),
  }),
  pattern: rawPatternSchema,
  musicQuality: rawMusicQualitySchema.optional(),
  visualCode: z.string().max(22000).catch(""),
  artwork: rawArtworkSchema.optional(),
});

export type GeneratedVibeInput = z.input<typeof generatedVibeSchema>;

export const vibeJsonSchema = {
  name: "GeneratedVibe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name", "subtitle", "tagline", "glyph", "visual", "palette", "params", "pattern", "visualCode"],
    properties: {
      id: { type: "string", description: "URL-safe lowercase id, e.g. neon-rain-study" },
      name: { type: "string", description: "中文展示名，2-8 个汉字优先" },
      subtitle: { type: "string", description: "英文副名" },
      tagline: { type: "string", description: "一句中文氛围描述" },
      glyph: { type: "string", description: "1 个符号字符" },
      visual: { type: "string", enum: VISUAL_TYPES },
      palette: {
        type: "object",
        additionalProperties: false,
        required: ["accent", "accent2", "base"],
        properties: {
          accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          accent2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          base: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        },
      },
      params: {
        type: "object",
        additionalProperties: false,
        required: ["energy", "warmth", "space", "brightness", "ambience", "density", "tempo"],
        properties: {
          energy: { type: "number", minimum: 0, maximum: 1 },
          warmth: { type: "number", minimum: 0, maximum: 1 },
          space: { type: "number", minimum: 0, maximum: 1 },
          brightness: { type: "number", minimum: 0, maximum: 1 },
          ambience: { type: "number", minimum: 0, maximum: 1 },
          density: { type: "number", minimum: 0, maximum: 1 },
          tempo: { type: "number", minimum: 40, maximum: 140 },
        },
      },
      pattern: {
        type: "object",
        additionalProperties: false,
        required: ["root", "scale", "chords", "seed", "layers", "mini", "strudel", "arrangement"],
        properties: {
          root: { type: "string", enum: NOTE_ROOTS },
          scale: { type: "string", enum: SCALE_TYPES },
          chords: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "string",
              enum: ROMAN_CHORD_SYMBOLS,
              description: "Roman numeral chord only. Never output absolute names like Cm7, Fm7, Abmaj7.",
            },
          },
          seed: { type: "integer" },
          layers: {
            type: "object",
            additionalProperties: false,
            required: LAYER_TYPES,
            properties: Object.fromEntries(
              LAYER_TYPES.map((layer) => [
                layer,
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["enabled", "density", "swing", "octave"],
                  properties: {
                    enabled: { type: "boolean" },
                    density: { type: "number", minimum: 0, maximum: 1 },
                    swing: { type: "number", minimum: 0, maximum: 0.35 },
                    octave: { type: "number", minimum: 1, maximum: 6 },
                  },
                },
              ]),
            ),
          },
          mini: {
            type: "object",
            additionalProperties: false,
            required: ["drums", "bassline", "melodyMotif", "arpPattern"],
            properties: {
              drums: {
                type: "object",
                additionalProperties: false,
                required: ["kick", "snare", "hat", "percussion"],
                properties: {
                  kick: {
                    type: "string",
                    pattern: "^[xX.\\-]{16}([xX.\\-]{16})?$",
                    description: "16 or 32 step kick pattern. x=hit, X=accent, .=ghost, -=rest.",
                  },
                  snare: {
                    type: "string",
                    pattern: "^[xX.\\-]{16}([xX.\\-]{16})?$",
                    description: "16 or 32 step snare pattern. x=hit, X=accent, .=ghost, -=rest.",
                  },
                  hat: {
                    type: "string",
                    pattern: "^[xX.\\-]{16}([xX.\\-]{16})?$",
                    description: "16 or 32 step hi-hat pattern. x=hit, X=accent, .=ghost, -=rest.",
                  },
                  percussion: {
                    type: "string",
                    pattern: "^[xX.\\-]{16}([xX.\\-]{16})?$",
                    description: "16 or 32 step optional percussion pattern. Use all rests when absent.",
                  },
                },
              },
              bassline: {
                type: "string",
                pattern: "^[0-7\\-]{16}([0-7\\-]{16})?$",
                description: "16 or 32 step scale-degree bassline. 0-7=scale degree, -=rest.",
              },
              melodyMotif: {
                type: "string",
                pattern: "^[0-7\\-]{16}([0-7\\-]{16})?$",
                description: "16 or 32 step memorable scale-degree melody motif. 0-7=scale degree, -=rest.",
              },
              arpPattern: {
                type: "string",
                pattern: "^[0-7\\-]{16}([0-7\\-]{16})?$",
                description: "16 or 32 step arpeggio pattern. 0-7=scale degree, -=rest.",
              },
            },
          },
          strudel: {
            type: "object",
            additionalProperties: false,
            required: ["version", "code", "notes"],
            properties: {
              version: { type: "integer", enum: [1] },
              code: {
                type: "string",
                maxLength: 5200,
                description:
                  "A single safe Strudel expression starting with stack(...). No semicolons, imports, browser APIs, comments, braces, or arbitrary JavaScript. Include .cpm(tempo/4) and .analyze(1).",
              },
              notes: {
                type: "string",
                maxLength: 240,
                description: "Short explanation of the Strudel groove and sound choices.",
              },
            },
          },
          arrangement: {
            type: "object",
            additionalProperties: false,
            required: ["form", "keyMood", "chordPalette", "roles", "mix"],
            properties: {
              form: {
                type: "string",
                maxLength: 160,
                description: "Phrase form, e.g. 8-bar A/B loop with one restrained transition.",
              },
              keyMood: {
                type: "string",
                maxLength: 160,
                description: "Tonal and emotional direction.",
              },
              chordPalette: {
                type: "string",
                maxLength: 160,
                description: "How chord qualities and voicings support the scene.",
              },
              roles: {
                type: "array",
                minItems: 4,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["role", "instrument", "purpose", "pattern", "register", "gain", "motion"],
                  properties: {
                    role: { type: "string", enum: ARRANGEMENT_ROLES },
                    instrument: { type: "string", maxLength: 80 },
                    purpose: { type: "string", maxLength: 120 },
                    pattern: { type: "string", maxLength: 120 },
                    register: { type: "string", enum: ["low", "mid", "high", "wide"] },
                    gain: { type: "number", minimum: 0, maximum: 0.9 },
                    motion: { type: "string", enum: ["static", "slow", "pulse", "syncopated", "sparkle"] },
                  },
                },
              },
              mix: {
                type: "object",
                additionalProperties: false,
                required: ["masterGain", "peakCeilingDb", "ambienceGain", "foreground", "notes"],
                properties: {
                  masterGain: { type: "number", minimum: 0.55, maximum: 0.9 },
                  peakCeilingDb: { type: "number", minimum: -6, maximum: -0.5 },
                  ambienceGain: { type: "number", minimum: 0, maximum: 0.08 },
                  foreground: { type: "string", maxLength: 80 },
                  notes: { type: "string", maxLength: 180 },
                },
              },
            },
          },
        },
      },
      visualCode: {
        type: "string",
        description: "完整 HTML 文档字符串。必须自包含，只能用内联 CSS/JS 和 Canvas/SVG/DOM。",
      },
    },
  },
} as const;

export const musicBlueprintJsonSchema = {
  name: "MusicBlueprint",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name", "subtitle", "tagline", "glyph", "visual", "palette", "params", "pattern"],
    properties: Object.fromEntries(
      Object.entries(vibeJsonSchema.schema.properties).filter(([key]) => key !== "visualCode"),
    ),
  },
} as const;

export const moodPlanJsonSchema = {
  name: "MoodPlan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name", "subtitle", "tagline", "glyph", "visual", "palette", "params", "root", "scale", "seed"],
    properties: {
      id: vibeJsonSchema.schema.properties.id,
      name: vibeJsonSchema.schema.properties.name,
      subtitle: vibeJsonSchema.schema.properties.subtitle,
      tagline: vibeJsonSchema.schema.properties.tagline,
      glyph: vibeJsonSchema.schema.properties.glyph,
      visual: vibeJsonSchema.schema.properties.visual,
      palette: vibeJsonSchema.schema.properties.palette,
      params: vibeJsonSchema.schema.properties.params,
      root: vibeJsonSchema.schema.properties.pattern.properties.root,
      scale: vibeJsonSchema.schema.properties.pattern.properties.scale,
      seed: vibeJsonSchema.schema.properties.pattern.properties.seed,
    },
  },
} as const;

export const compositionPlanJsonSchema = {
  name: "CompositionPlan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["chords", "mini", "strudel", "arrangement"],
    properties: {
      chords: vibeJsonSchema.schema.properties.pattern.properties.chords,
      mini: vibeJsonSchema.schema.properties.pattern.properties.mini,
      strudel: vibeJsonSchema.schema.properties.pattern.properties.strudel,
      arrangement: vibeJsonSchema.schema.properties.pattern.properties.arrangement,
    },
  },
} as const;

export const soundDesignPlanJsonSchema = {
  name: "SoundDesignPlan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["params", "layers"],
    properties: {
      params: vibeJsonSchema.schema.properties.params,
      layers: vibeJsonSchema.schema.properties.pattern.properties.layers,
    },
  },
} as const;

export const criticPlanJsonSchema = {
  name: "CriticPlan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok", "issues", "blueprint"],
    properties: {
      ok: { type: "boolean" },
      issues: {
        type: "array",
        maxItems: 8,
        items: { type: "string", maxLength: 120 },
      },
      blueprint: musicBlueprintJsonSchema.schema,
    },
  },
} as const;

export const visualJsonSchema = {
  name: "VibeVisual",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["visualCode"],
    properties: {
      visualCode: vibeJsonSchema.schema.properties.visualCode,
    },
  },
} as const;

export const visualOutputSchema = z.object({
  visualCode: z.string().max(22000).catch(""),
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLayer(layer: z.infer<typeof rawLayerSchema>) {
  return {
    enabled: layer.enabled,
    density: clamp(layer.density, 0, 1),
    swing: clamp(layer.swing, 0, 0.35),
    octave: Math.round(clamp(layer.octave ?? 4, 1, 6)),
  };
}

function normalizeMiniPatternString(value: string | undefined, fallback: string, allowed: RegExp) {
  const cleaned = (value || fallback)
    .replace(/\s+/g, "")
    .split("")
    .filter((char) => allowed.test(char))
    .join("");

  if (cleaned.length === 16 || cleaned.length === 32) return cleaned;
  if (cleaned.length > 0 && cleaned.length < 16) return cleaned.padEnd(16, "-");
  if (cleaned.length > 16 && cleaned.length < 32) return cleaned.padEnd(32, "-");
  if (cleaned.length > 32) return cleaned.slice(0, 32);
  return fallback;
}

function normalizeMiniPattern(mini: z.infer<typeof rawMiniSchema> | undefined) {
  if (!mini) return undefined;

  return {
    drums: {
      kick: normalizeMiniPatternString(mini.drums.kick, "x---x---x---x---", /[xX.\-]/),
      snare: normalizeMiniPatternString(mini.drums.snare, "----x-------x---", /[xX.\-]/),
      hat: normalizeMiniPatternString(mini.drums.hat, "x-x-x-x-x-x-x-x-", /[xX.\-]/),
      percussion: normalizeMiniPatternString(mini.drums.percussion, "----------------", /[xX.\-]/),
    },
    bassline: normalizeMiniPatternString(mini.bassline, "0---0---4---3---", /[0-7\-]/),
    melodyMotif: normalizeMiniPatternString(mini.melodyMotif, "0-2-4---2---0---", /[0-7\-]/),
    arpPattern: normalizeMiniPatternString(mini.arpPattern, "02420242--------", /[0-7\-]/),
  };
}

function normalizeStrudelPattern(strudel: z.infer<typeof rawStrudelSchema> | undefined) {
  const code = sanitizeStrudelCode(strudel?.code);
  if (!code) return undefined;

  return {
    version: 1 as const,
    code,
    notes: strudel?.notes?.trim() || undefined,
  };
}

function normalizeArrangementPlan(arrangement: z.infer<typeof rawArrangementSchema> | undefined) {
  if (!arrangement) return undefined;

  return {
    form: arrangement.form.trim(),
    keyMood: arrangement.keyMood.trim(),
    chordPalette: arrangement.chordPalette.trim(),
    roles: arrangement.roles.slice(0, 7).map((role) => ({
      role: role.role as ArrangementRoleType,
      instrument: role.instrument.trim(),
      purpose: role.purpose.trim(),
      pattern: role.pattern.trim(),
      register: role.register,
      gain: clamp(role.gain, 0, 0.9),
      motion: role.motion,
    })),
    mix: {
      masterGain: clamp(arrangement.mix.masterGain, 0.55, 0.9),
      peakCeilingDb: clamp(arrangement.mix.peakCeilingDb, -6, -0.5),
      ambienceGain: clamp(arrangement.mix.ambienceGain, 0, 0.08),
      foreground: arrangement.mix.foreground.trim(),
      notes: arrangement.mix.notes.trim(),
    },
  };
}

function normalizeMusicQuality(quality: z.infer<typeof rawMusicQualitySchema> | undefined) {
  if (!quality) return undefined;

  return {
    score: clamp(quality.score, 0, 100),
    repaired: quality.repaired,
    issues: quality.issues.slice(0, 12).map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
    })),
  };
}

export function normalizeGeneratedVibe(input: unknown): Vibe {
  const parsed = generatedVibeSchema.parse(input);
  const id = parsed.id || `ai-vibe-${parsed.pattern.seed}`;
  const layers = Object.fromEntries(
    (Object.keys(parsed.pattern.layers) as LayerType[]).map((layer) => [
      layer,
      normalizeLayer(parsed.pattern.layers[layer]),
    ]),
  ) as Vibe["pattern"] extends infer Pattern
    ? Pattern extends { layers: infer Layers }
      ? Layers
      : never
    : never;

  return {
    id,
    name: parsed.name,
    subtitle: parsed.subtitle,
    tagline: parsed.tagline,
    glyph: parsed.glyph,
    visual: parsed.visual as VisualType,
    palette: parsed.palette,
    params: {
      energy: clamp(parsed.params.energy, 0, 1),
      warmth: clamp(parsed.params.warmth, 0, 1),
      space: clamp(parsed.params.space, 0, 1),
      brightness: clamp(parsed.params.brightness, 0, 1),
      ambience: clamp(parsed.params.ambience, 0, 1),
      density: clamp(parsed.params.density, 0, 1),
      tempo: clamp(parsed.params.tempo, 40, 140),
    },
    pattern: {
      root: normalizeRootNote(parsed.pattern.root),
      scale: parsed.pattern.scale as ScaleType,
      chords: normalizeChordProgression(
        { root: normalizeRootNote(parsed.pattern.root), scale: parsed.pattern.scale as ScaleType },
        parsed.pattern.chords,
      ),
      seed: parsed.pattern.seed,
      layers,
      mini: normalizeMiniPattern(parsed.pattern.mini),
      strudel: normalizeStrudelPattern(parsed.pattern.strudel),
      arrangement: normalizeArrangementPlan(parsed.pattern.arrangement),
    },
    musicQuality: normalizeMusicQuality(parsed.musicQuality),
    visualCode: parsed.visualCode,
    artwork: parsed.artwork?.imageUrl ? parsed.artwork : undefined,
    source: "ai",
  };
}

function promptHash(prompt: string) {
  let hash = 2166136261;
  for (let index = 0; index < prompt.length; index += 1) {
    hash ^= prompt.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

function promptSnippet(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 8) || "新氛围";
}

type FallbackOverrides = Partial<Omit<Vibe, "pattern">> & {
  pattern?: Partial<NonNullable<Vibe["pattern"]>>;
};

function pickFallbackBase(prompt: string): { base: Vibe; overrides: FallbackOverrides } {
  const text = prompt.toLowerCase();
  const find = (id: string) => VIBES.find((vibe) => vibe.id === id) ?? VIBES[0];

  if (/春|樱|花|sakura|cherry|blossom|spring|garden|阳光|日光|清晨|morning/.test(text)) {
    return {
      base: find("forest-walk"),
      overrides: {
        name: `${promptSnippet(prompt)}唱片`,
        subtitle: "Spring Air Record",
        tagline: prompt.trim() ? `把「${prompt.slice(0, 28)}」刻成清亮、轻盈的循环。` : "花影与日光轻轻落在节拍上。",
        glyph: "✿",
        visual: "particles" as const,
        palette: { accent: "#ffb7c5", accent2: "#9be7c7", base: "#07100c" },
        params: {
          energy: 0.48,
          warmth: 0.58,
          space: 0.42,
          brightness: 0.78,
          ambience: 0.16,
          density: 0.46,
          tempo: 92,
        },
        pattern: {
          root: "G",
          scale: "majorPentatonic" as const,
          chords: ["Iadd9", "V", "vi", "IVmaj7"],
          mini: {
            drums: {
              kick: "x---x-----x---x-",
              snare: "----x-------x---",
              hat: "x-x-xx-x-x-x-xx-",
              percussion: "--.-.--.----.--.",
            },
            bassline: "0---4---5---4---",
            melodyMotif: "0-2-4---5-4-2---",
            arpPattern: "0245--42--245---",
          },
        },
      },
    };
  }

  if (/夏|海|浪|beach|ocean|sea|wave|island/.test(text)) {
    return {
      base: find("forest-walk"),
      overrides: {
        name: `${promptSnippet(prompt)}声景`,
        subtitle: "Coastal Loop",
        glyph: "◌",
        visual: "waves" as const,
        palette: { accent: "#38bdf8", accent2: "#facc15", base: "#061015" },
        params: { energy: 0.52, warmth: 0.52, space: 0.5, brightness: 0.74, ambience: 0.34, density: 0.44, tempo: 96 },
      },
    };
  }

  if (/雨|rain|lo-?fi|lofi|窗|夜读/.test(text)) return { base: find("rainy-lofi"), overrides: {} };
  if (/雪|冬|winter|snow|冷|孤独/.test(text)) return { base: find("cosmic-drift"), overrides: {} };
  if (/代码|霓虹|city|城市|coding|neon|cyber/.test(text)) return { base: find("cyber-night"), overrides: {} };
  if (/学习|专注|focus|study|阅读|read/.test(text)) return { base: find("deep-focus"), overrides: {} };
  if (/宇宙|星|space|cosmic|漂浮/.test(text)) return { base: find("cosmic-drift"), overrides: {} };

  return { base: VIBES[Math.abs(prompt.length) % VIBES.length], overrides: {} };
}

export function fallbackGeneratedVibe(prompt: string): Vibe {
  const { base, overrides } = pickFallbackBase(prompt);
  const seed = Number.parseInt(promptHash(prompt), 36) || base.pattern?.seed || 1337;
  const patternOverride = overrides.pattern;
  const hasMiniOverride = Boolean(patternOverride?.mini);
  const layers = base.pattern?.layers
    ? {
        drums: { ...base.pattern.layers.drums },
        bass: { ...base.pattern.layers.bass },
        pad: { ...base.pattern.layers.pad },
        melody: { ...base.pattern.layers.melody },
        arp: { ...base.pattern.layers.arp },
      }
    : undefined;
  const layerOverride = patternOverride?.layers;
  const miniOverride = patternOverride?.mini;
  const normalizedMiniOverride = miniOverride
    ? normalizeMiniPattern({
        drums: {
          kick: miniOverride.drums?.kick ?? "x---x---x---x---",
          snare: miniOverride.drums?.snare ?? "----x-------x---",
          hat: miniOverride.drums?.hat ?? "x-x-x-x-x-x-x-x-",
          percussion: miniOverride.drums?.percussion ?? "----------------",
        },
        bassline: miniOverride.bassline ?? "0---0---4---3---",
        melodyMotif: miniOverride.melodyMotif ?? "0-2-4---2---0---",
        arpPattern: miniOverride.arpPattern ?? "02420242--------",
      })
    : undefined;
  const mergedLayers =
    layers && layerOverride
      ? {
          drums: { ...layers.drums, ...layerOverride.drums },
          bass: { ...layers.bass, ...layerOverride.bass },
          pad: { ...layers.pad, ...layerOverride.pad },
          melody: { ...layers.melody, ...layerOverride.melody },
          arp: { ...layers.arp, ...layerOverride.arp },
        }
      : layers ?? base.pattern?.layers;

  return {
    ...base,
    ...overrides,
    id: `ai-${base.id}-${promptHash(prompt)}`,
    name: overrides.name ?? "自制" + base.name,
    subtitle: overrides.subtitle ?? "AI " + base.subtitle,
    tagline: overrides.tagline ?? (prompt.trim() ? `根据「${prompt.slice(0, 28)}」生成的氛围唱片。` : base.tagline),
    palette: overrides.palette ?? base.palette,
    params: overrides.params ?? base.params,
    pattern: base.pattern
      ? {
          ...base.pattern,
          ...patternOverride,
          seed,
          layers: mergedLayers ?? base.pattern.layers,
          mini: hasMiniOverride
            ? normalizedMiniOverride
            : base.pattern.mini ??
            normalizeMiniPattern({
              drums: {
                kick: base.pattern.layers.drums.enabled ? "x---x---x---x---" : "----------------",
                snare: base.pattern.layers.drums.enabled ? "----x-------x---" : "----------------",
                hat: base.pattern.layers.drums.enabled ? "x-x-x-x-x-x-x-x-" : "----------------",
                percussion: "----------------",
              },
              bassline: "0---0---4---3---",
              melodyMotif: "0-2-4---2---0---",
              arpPattern: base.pattern.layers.arp.enabled ? "02420242--------" : "----------------",
            }),
        }
      : undefined,
    source: "ai",
  };
}
