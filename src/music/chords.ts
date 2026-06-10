import type { ScaleType, VibePattern } from "@/data/vibes";

export const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_ROOTS = Object.keys(NOTE_SEMITONES);

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export const ROMAN_TO_DEGREE: Record<string, number> = {
  I: 0,
  i: 0,
  II: 1,
  ii: 1,
  III: 2,
  iii: 2,
  IV: 3,
  iv: 3,
  V: 4,
  v: 4,
  VI: 5,
  vi: 5,
  VII: 6,
  vii: 6,
};

const ROMAN_BY_DEGREE = ["I", "II", "III", "IV", "V", "VI", "VII"];
const QUALITY_SUFFIXES = ["", "maj7", "m7", "7", "sus2", "sus4", "add9"] as const;

export const ROMAN_CHORD_SYMBOLS = Object.keys(ROMAN_TO_DEGREE).flatMap((roman) =>
  QUALITY_SUFFIXES.map((suffix) => `${roman}${suffix}`),
);

export type ChordQuality = "" | "maj7" | "m7" | "7" | "sus2" | "sus4" | "add9";

export interface ParsedChord {
  roman: string;
  degree: number;
  quality: ChordQuality;
  rootOffset: number;
}

function normalizeNoteName(note: string) {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!match) return "C";
  return `${match[1].toUpperCase()}${match[2] ?? ""}`;
}

export function normalizeRootNote(note: string) {
  const normalized = normalizeNoteName(note);
  return NOTE_SEMITONES[normalized] === undefined ? "C" : normalized;
}

function normalizeQuality(value = ""): ChordQuality {
  const quality = value.trim();
  if (quality === "maj7" || quality === "M7") return "maj7";
  if (quality === "m7" || quality === "min7") return "m7";
  if (quality === "7") return "7";
  if (quality === "sus2") return "sus2";
  if (quality === "sus4") return "sus4";
  if (quality === "add9") return "add9";
  return "";
}

function qualityImpliesMinor(value = "") {
  return value === "m" || value === "min" || value === "m7" || value === "min7";
}

function defaultTonic(pattern: Pick<VibePattern, "scale">) {
  return pattern.scale === "major" || pattern.scale === "majorPentatonic" || pattern.scale === "lydian" ? "I" : "i";
}

function parseRomanChord(symbol: string): { roman: string; quality: ChordQuality } | null {
  const normalized = symbol.trim();
  const match = normalized.match(/^(VII|vii|III|iii|VI|vi|IV|iv|II|ii|V|v|I|i)(maj7|m7|7|sus2|sus4|add9)?$/);
  if (!match) return null;
  return {
    roman: match[1],
    quality: normalizeQuality(match[2]),
  };
}

function romanForAbsoluteChord(pattern: Pick<VibePattern, "root" | "scale">, symbol: string) {
  const match = symbol.trim().match(/^([A-Ga-g](?:#|b)?)(maj7|min7|m7|M7|sus2|sus4|add9|7|min|m)?$/);
  if (!match) return null;

  const root = NOTE_SEMITONES[normalizeRootNote(pattern.root)] ?? 0;
  const chordRoot = NOTE_SEMITONES[normalizeNoteName(match[1])];
  if (chordRoot === undefined) return null;

  const interval = (chordRoot - root + 12) % 12;
  const scaleIntervals = SCALE_INTERVALS[pattern.scale] ?? SCALE_INTERVALS.minorPentatonic;
  let degree = scaleIntervals.findIndex((candidate) => candidate === interval);
  if (degree < 0) {
    degree = SCALE_INTERVALS.minor.findIndex((candidate) => candidate === interval);
  }
  if (degree < 0) {
    degree = SCALE_INTERVALS.major.findIndex((candidate) => candidate === interval);
  }
  if (degree < 0) return null;

  const rawQuality = match[2] ?? "";
  const quality = normalizeQuality(rawQuality);
  const baseRoman = ROMAN_BY_DEGREE[degree] ?? defaultTonic(pattern);
  const roman = qualityImpliesMinor(rawQuality) ? baseRoman.toLowerCase() : baseRoman;

  return `${roman}${quality}`;
}

export function normalizeChordSymbol(pattern: Pick<VibePattern, "root" | "scale">, chord: string) {
  const roman = parseRomanChord(chord);
  if (roman) return `${roman.roman}${roman.quality}`;

  return romanForAbsoluteChord(pattern, chord) ?? defaultTonic(pattern);
}

export function normalizeChordProgression(pattern: Pick<VibePattern, "root" | "scale">, chords: string[]) {
  const normalized = chords.map((chord) => normalizeChordSymbol(pattern, chord)).slice(0, 8);
  return normalized.length > 0 ? normalized : [defaultTonic(pattern), "VI", "III", "VII"];
}

export function parseChord(pattern: Pick<VibePattern, "root" | "scale">, chord: string): ParsedChord {
  const normalized = normalizeChordSymbol(pattern, chord);
  const parsed = parseRomanChord(normalized);
  const fallbackRoman = defaultTonic(pattern);
  const roman = parsed?.roman ?? fallbackRoman;
  const degree = ROMAN_TO_DEGREE[roman] ?? 0;
  const intervals = SCALE_INTERVALS[pattern.scale] ?? SCALE_INTERVALS.minorPentatonic;

  return {
    roman,
    degree,
    quality: parsed?.quality ?? "",
    rootOffset: intervals[degree % intervals.length] ?? 0,
  };
}
