import type { VibePattern } from "@/data/vibes";
import { NOTE_NAMES, NOTE_SEMITONES, SCALE_INTERVALS, normalizeRootNote, parseChord } from "@/music/chords";

export function createSeededRandom(seed: number) {
  let state = Math.max(1, Math.floor(Math.abs(seed)) % 2147483647);
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function noteNameFromMidi(midi: number) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

function rootMidi(root: string, octave: number) {
  return 12 * (octave + 1) + (NOTE_SEMITONES[normalizeRootNote(root)] ?? 0);
}

export function getScaleNotes(pattern: VibePattern, octave = 4) {
  const base = rootMidi(pattern.root, octave);
  const intervals = SCALE_INTERVALS[pattern.scale] ?? SCALE_INTERVALS.minorPentatonic;
  return intervals.map((interval) => noteNameFromMidi(base + interval));
}

export function getChordNotes(pattern: VibePattern, chord: string, octave = 4) {
  const parsed = parseChord(pattern, chord);
  const intervals = SCALE_INTERVALS[pattern.scale] ?? SCALE_INTERVALS.minorPentatonic;
  const base = rootMidi(pattern.root, octave) + parsed.rootOffset;

  if (parsed.quality === "maj7") return [0, 4, 7, 11].map((interval) => noteNameFromMidi(base + interval));
  if (parsed.quality === "m7") return [0, 3, 7, 10].map((interval) => noteNameFromMidi(base + interval));
  if (parsed.quality === "7") return [0, 4, 7, 10].map((interval) => noteNameFromMidi(base + interval));
  if (parsed.quality === "sus2") return [0, 2, 7].map((interval) => noteNameFromMidi(base + interval));
  if (parsed.quality === "sus4") return [0, 5, 7].map((interval) => noteNameFromMidi(base + interval));
  if (parsed.quality === "add9") {
    const third = parsed.roman === parsed.roman.toLowerCase() ? 3 : 4;
    return [0, third, 7, 14].map((interval) => noteNameFromMidi(base + interval));
  }

  const degree = parsed.degree;
  const chordIntervals = [0, 2, 4].map((offset) => intervals[(degree + offset) % intervals.length] - parsed.rootOffset);
  return chordIntervals.map((interval) => noteNameFromMidi(base + interval));
}

export function choose<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length) % items.length];
}
