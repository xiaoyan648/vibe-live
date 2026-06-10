import type { Vibe, VibeParams, VisualType } from "@/data/vibes";

export type TextureKind = "rain" | "wind" | "city" | "tape" | "space" | "vinyl" | "none";

export interface TextureProfile {
  kind: TextureKind;
  noise: "white" | "pink" | "brown";
  filterType: "lowpass" | "highpass" | "bandpass";
  cutoff: number;
  q: number;
  gain: number;
  detailProbability: number;
}

const VISUAL_TEXTURE: Partial<Record<VisualType, TextureKind>> = {
  rain: "rain",
  waves: "wind",
  cosmos: "space",
  particles: "vinyl",
  orbs: "city",
};

function inferTextureKind(vibe: Vibe): TextureKind {
  const text = `${vibe.id} ${vibe.name} ${vibe.subtitle} ${vibe.tagline}`.toLowerCase();

  if (/雨|rain|lo-?fi|lofi/.test(text)) return "rain";
  if (/森林|风|wind|forest|walk/.test(text)) return "wind";
  if (/磁带|黑胶|tape|vinyl|lo-?fi|lofi/.test(text)) return "tape";
  if (/城市|霓虹|代码|赛博|city|neon|cyber|code|coding/.test(text)) return "city";
  if (/宇宙|星|漂浮|space|cosmic|drift/.test(text)) return "space";

  return VISUAL_TEXTURE[vibe.visual] ?? "vinyl";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTextureProfile(vibe: Vibe, params: VibeParams): TextureProfile {
  const ambience = clamp(params.ambience, 0, 1);
  const brightness = clamp(params.brightness, 0, 1);
  const warmth = clamp(params.warmth, 0, 1);
  const baseGain = Math.pow(ambience, 1.65);
  const kind = ambience < 0.06 ? "none" : inferTextureKind(vibe);

  if (kind === "rain") {
    return {
      kind,
      noise: "white",
      filterType: "highpass",
      cutoff: 1500 + brightness * 3300,
      q: 0.7,
      gain: baseGain * 0.06,
      detailProbability: ambience * 0.38,
    };
  }

  if (kind === "wind") {
    return {
      kind,
      noise: "brown",
      filterType: "lowpass",
      cutoff: 420 + params.space * 1050,
      q: 0.5,
      gain: baseGain * 0.045,
      detailProbability: ambience * 0.14,
    };
  }

  if (kind === "city") {
    return {
      kind,
      noise: "pink",
      filterType: "bandpass",
      cutoff: 620 + brightness * 1550,
      q: 0.85,
      gain: baseGain * 0.044,
      detailProbability: ambience * 0.28,
    };
  }

  if (kind === "tape" || kind === "vinyl") {
    return {
      kind,
      noise: "pink",
      filterType: "bandpass",
      cutoff: 850 + warmth * 650,
      q: 0.62,
      gain: baseGain * 0.028,
      detailProbability: ambience * 0.18,
    };
  }

  if (kind === "space") {
    return {
      kind,
      noise: "pink",
      filterType: "lowpass",
      cutoff: 260 + params.space * 540,
      q: 0.42,
      gain: baseGain * 0.024,
      detailProbability: ambience * 0.1,
    };
  }

  return {
    kind: "none",
    noise: "pink",
    filterType: "lowpass",
    cutoff: 800,
    q: 0.7,
    gain: 0,
    detailProbability: 0,
  };
}
