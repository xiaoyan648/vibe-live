export type DrumHit = "kick" | "snare" | "hat" | "percussion";

export interface MiniPatternV2 {
  drums?: Partial<Record<DrumHit, string>>;
  bassline?: string;
  melodyMotif?: string;
  arpPattern?: string;
}

export interface ParsedDrumEvent {
  step: number;
  velocity: number;
}

export interface ParsedNoteEvent {
  step: number;
  degree: number;
  octave?: number;
  velocity: number;
}

export interface ParsedMiniPattern {
  steps: number;
  drums: Record<DrumHit, ParsedDrumEvent[]>;
  bassline: ParsedNoteEvent[];
  melodyMotif: ParsedNoteEvent[];
  arpPattern: ParsedNoteEvent[];
}

const DEFAULT_STEPS = 16;
const FALLBACK_DRUMS: Record<DrumHit, string> = {
  kick: "x---x---x---x---",
  snare: "----x-------x---",
  hat: "x-x-x-x-x-x-x-x-",
  percussion: "----------------",
};

function normalizePatternString(pattern: string | undefined, fallback: string) {
  const cleaned = (pattern || fallback).replace(/\s+/g, "");
  const valid = cleaned
    .split("")
    .filter((char) => /[xX0-7.\-]/.test(char))
    .join("");

  if (valid.length === 16 || valid.length === 32) return valid;
  if (valid.length > 0 && valid.length < 16) return valid.padEnd(16, "-");
  if (valid.length > 16 && valid.length < 32) return valid.padEnd(32, "-");
  if (valid.length > 32) return valid.slice(0, 32);

  return fallback;
}

function patternLength(...patterns: string[]) {
  return patterns.some((pattern) => pattern.length === 32) ? 32 : DEFAULT_STEPS;
}

function fitPattern(pattern: string, steps: number) {
  if (pattern.length === steps) return pattern;
  if (pattern.length > steps) return pattern.slice(0, steps);
  return pattern.padEnd(steps, "-");
}

function parseDrum(pattern: string): ParsedDrumEvent[] {
  return pattern
    .split("")
    .map((char, step) => {
      if (char === "x") return { step, velocity: 0.78 };
      if (char === "X") return { step, velocity: 1 };
      if (char === ".") return { step, velocity: 0.36 };
      return null;
    })
    .filter((event): event is ParsedDrumEvent => Boolean(event));
}

function parseNotes(pattern: string): ParsedNoteEvent[] {
  return pattern
    .split("")
    .map((char, step) => {
      if (!/[0-7]/.test(char)) return null;
      return {
        step,
        degree: Number(char),
        velocity: 0.62,
      };
    })
    .filter((event): event is ParsedNoteEvent => Boolean(event));
}

export function parseMiniPattern(pattern: MiniPatternV2 | undefined): ParsedMiniPattern {
  const kick = normalizePatternString(pattern?.drums?.kick, FALLBACK_DRUMS.kick);
  const snare = normalizePatternString(pattern?.drums?.snare, FALLBACK_DRUMS.snare);
  const hat = normalizePatternString(pattern?.drums?.hat, FALLBACK_DRUMS.hat);
  const percussion = normalizePatternString(pattern?.drums?.percussion, FALLBACK_DRUMS.percussion);
  const bassline = normalizePatternString(pattern?.bassline, "0---0---4---3---");
  const melodyMotif = normalizePatternString(pattern?.melodyMotif, "0-2-4---2---0---");
  const arpPattern = normalizePatternString(pattern?.arpPattern, "02420242--------");
  const steps = patternLength(kick, snare, hat, percussion, bassline, melodyMotif, arpPattern);

  return {
    steps,
    drums: {
      kick: parseDrum(fitPattern(kick, steps)),
      snare: parseDrum(fitPattern(snare, steps)),
      hat: parseDrum(fitPattern(hat, steps)),
      percussion: parseDrum(fitPattern(percussion, steps)),
    },
    bassline: parseNotes(fitPattern(bassline, steps)),
    melodyMotif: parseNotes(fitPattern(melodyMotif, steps)),
    arpPattern: parseNotes(fitPattern(arpPattern, steps)),
  };
}
