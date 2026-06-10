import type { VibeParams } from "@/data/vibes";

export interface AudioMapping {
  bpm: number;
  masterVolume: number;
  reverbWet: number;
  delayWet: number;
  filterCutoff: number;
  padAttack: number;
  padRelease: number;
  drumVelocity: number;
  noteProbability: number;
  textureAmount: number;
}

export function mapParamsToAudio(params: VibeParams): AudioMapping {
  const warmth = params.warmth;
  const brightness = params.brightness;

  return {
    bpm: Math.round(params.tempo),
    masterVolume: 0.42 + params.energy * 0.32,
    reverbWet: 0.14 + params.space * 0.46,
    delayWet: 0.06 + params.space * 0.18,
    filterCutoff: 520 + brightness * 4200 - warmth * 900,
    padAttack: 0.2 + params.space * 0.9,
    padRelease: 0.9 + params.space * 3.1,
    drumVelocity: 0.2 + params.energy * 0.7,
    noteProbability: 0.15 + params.density * 0.72,
    textureAmount: Math.pow(params.ambience, 1.65),
  };
}
