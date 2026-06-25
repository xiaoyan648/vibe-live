import type { Vibe } from "@/data/vibes";

export interface DiversityReport {
  score: number;
  nearestId?: string;
  similarity: number;
  reasons: string[];
}

function compact(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, "");
}

function hammingSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const length = Math.max(left.length, right.length);
  let same = 0;
  for (let index = 0; index < length; index += 1) {
    if ((left[index] ?? "") === (right[index] ?? "")) same += 1;
  }
  return same / length;
}

function setSimilarity(left: Set<string>, right: Set<string>) {
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  left.forEach((item) => {
    if (right.has(item)) intersection += 1;
  });
  return intersection / (left.size + right.size - intersection);
}

function soundSet(code: string | undefined) {
  const sounds = new Set<string>();
  const matcher = /\b(?:s|sound)\s*\(\s*["']([^"']+)["']/g;
  let match = matcher.exec(code ?? "");
  while (match) {
    for (const token of match[1].split(/\s+/)) {
      const normalized = token.split(":")[0]?.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
      if (normalized && normalized !== "~") sounds.add(normalized);
    }
    match = matcher.exec(code ?? "");
  }
  return sounds;
}

function signature(vibe: Vibe) {
  const mini = vibe.pattern?.mini;
  return {
    id: vibe.id,
    scale: vibe.pattern?.scale ?? "",
    chords: compact(vibe.pattern?.chords.join("|")),
    drum: compact(
      [
        mini?.drums?.kick,
        mini?.drums?.snare,
        mini?.drums?.hat,
        mini?.drums?.percussion,
      ].join("|"),
    ),
    notes: compact([mini?.bassline, mini?.melodyMotif, mini?.arpPattern].join("|")),
    sounds: soundSet(vibe.pattern?.strudel?.code),
    tempo: vibe.params.tempo,
  };
}

export function scoreVibeDiversity(vibe: Vibe, references: Vibe[]): DiversityReport {
  const current = signature(vibe);
  const scores = references
    .filter((reference) => reference.id !== vibe.id)
    .map((reference) => {
      const base = signature(reference);
      const chordSimilarity = current.chords && current.chords === base.chords ? 1 : hammingSimilarity(current.chords, base.chords);
      const drumSimilarity = hammingSimilarity(current.drum, base.drum);
      const noteSimilarity = hammingSimilarity(current.notes, base.notes);
      const soundSimilarity = setSimilarity(current.sounds, base.sounds);
      const tempoSimilarity = Math.max(0, 1 - Math.abs(current.tempo - base.tempo) / 36);
      const scaleSimilarity = current.scale === base.scale ? 1 : 0;
      const similarity =
        chordSimilarity * 0.2 +
        drumSimilarity * 0.22 +
        noteSimilarity * 0.26 +
        soundSimilarity * 0.18 +
        tempoSimilarity * 0.08 +
        scaleSimilarity * 0.06;

      return { id: reference.id, similarity };
    })
    .sort((left, right) => right.similarity - left.similarity);

  const nearest = scores[0];
  const similarity = nearest?.similarity ?? 0;
  const reasons: string[] = [];
  if (similarity > 0.74) reasons.push("too-close-to-builtin");
  if (current.sounds.size < 3) reasons.push("narrow-instrument-palette");
  if (new Set(vibe.pattern?.chords ?? []).size <= 2) reasons.push("low-chord-variety");

  return {
    score: Math.round(Math.max(0, Math.min(100, 100 - similarity * 100 - reasons.length * 8))),
    nearestId: nearest?.id,
    similarity,
    reasons,
  };
}
