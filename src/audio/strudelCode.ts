import { getChordNotes, getScaleNotes } from "./scheduler";
import type { Vibe, VibeParams, VibePattern } from "@/data/vibes";
import { prepareStrudelCode } from "@/music/strudelSafety";

const REST = "~";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function num(value: number, digits = 3) {
  return Number.parseFloat(value.toFixed(digits));
}

function q(value: string) {
  return JSON.stringify(value);
}

function noteForDegree(pattern: VibePattern, char: string, octave: number) {
  if (!/[0-7]/.test(char)) return REST;
  const notes = getScaleNotes(pattern, octave);
  return (notes[Number(char) % notes.length] ?? notes[0]).toLowerCase();
}

function noteMini(pattern: VibePattern, source: string | undefined, octave: number) {
  const cleaned = (source || "").replace(/\s+/g, "");
  if (!cleaned) return REST;
  return cleaned
    .split("")
    .map((char) => noteForDegree(pattern, char, octave))
    .join(" ");
}

function drumToken(char: string, sound: string, gain = 0.82) {
  if (char === "X") return `${sound}:0:${num(gain * 1.18, 2)}`;
  if (char === "x") return `${sound}:0:${num(gain, 2)}`;
  if (char === ".") return `${sound}:0:${num(gain * 0.42, 2)}`;
  return REST;
}

function drumMini(source: string | undefined, sound: string, gain?: number) {
  const cleaned = (source || "").replace(/\s+/g, "");
  if (!cleaned) return REST;
  return cleaned
    .split("")
    .map((char) => drumToken(char, sound, gain))
    .join(" ");
}

function layerEnabled(pattern: VibePattern, layer: keyof VibePattern["layers"]) {
  return pattern.layers[layer]?.enabled !== false;
}

function layerDensity(pattern: VibePattern, layer: keyof VibePattern["layers"]) {
  return clamp(pattern.layers[layer]?.density ?? 0.4, 0, 1);
}

function layerOctave(pattern: VibePattern, layer: keyof VibePattern["layers"], fallback: number) {
  return Math.round(clamp(pattern.layers[layer]?.octave ?? fallback, 1, 6));
}

function chordPattern(pattern: VibePattern) {
  const chords = (pattern.chords.length ? pattern.chords : ["I", "V", "vi", "IV"]).slice(0, 6);
  return `<${chords
    .map((chord) => `[${getChordNotes(pattern, chord, layerOctave(pattern, "pad", 4)).join(" ").toLowerCase()}]`)
    .join(" ")}>`;
}

function defaultMini(pattern: VibePattern) {
  return {
    drums: {
      kick: pattern.layers.drums.enabled ? "x---x-----x---x-" : "----------------",
      snare: pattern.layers.drums.enabled ? "----x-------x---" : "----------------",
      hat: pattern.layers.drums.enabled ? "x-x-xx-x-x-x-xx-" : "----------------",
      percussion: "----------------",
    },
    bassline: "0---4---5---4---",
    melodyMotif: "0-2-4---5-4-2---",
    arpPattern: pattern.layers.arp.enabled ? "0245--42--245---" : "----------------",
  };
}

function sceneTone(vibe: Vibe) {
  const text = `${vibe.id} ${vibe.name} ${vibe.subtitle} ${vibe.tagline}`.toLowerCase();
  if (/春|樱|花|spring|sakura|cherry|garden|日光|阳光|清晨/.test(text)) return "spring";
  if (/雨|rain|lofi|lo-fi|窗/.test(text)) return "rain";
  if (/森林|forest|walk|苔|鸟/.test(text)) return "forest";
  if (/代码|coding|霓虹|neon|cyber|city|城市/.test(text)) return "neon";
  if (/宇宙|space|cosmic|星|漂浮/.test(text)) return "space";
  return "neutral";
}

function synthFor(vibe: Vibe, role: "bass" | "pad" | "melody" | "arp") {
  const tone = sceneTone(vibe);
  if (role === "bass") return tone === "neon" ? "sawtooth" : "triangle";
  if (role === "pad") return tone === "space" ? "sine" : "triangle";
  if (role === "arp") return tone === "neon" ? "sawtooth" : "sine";
  return tone === "spring" || tone === "forest" ? "triangle" : "sine";
}

interface BuildStrudelCodeOptions {
  preferNative?: boolean;
}

export function buildStrudelCode(vibe: Vibe, params: VibeParams = vibe.params, options: BuildStrudelCodeOptions = {}) {
  const pattern = vibe.pattern;
  if (!pattern) {
    return `stack(note("c3 e3 g3").s("triangle").gain(.4)).cpm(${num(params.tempo / 4)}).analyze(1)`;
  }

  if (options.preferNative !== false) {
    const nativeCode = prepareStrudelCode(pattern.strudel?.code, params);
    if (nativeCode) {
      return nativeCode;
    }
  }

  const mini = pattern.mini ?? defaultMini(pattern);
  const layers: string[] = [];
  const room = clamp(0.08 + params.space * 0.34, 0.08, 0.48);
  const delay = clamp(params.space * 0.16, 0, 0.24);
  const cutoff = Math.round(650 + params.brightness * 5200 - params.warmth * 450);
  const tone = sceneTone(vibe);

  if (layerEnabled(pattern, "drums")) {
    const swing = clamp(pattern.layers.drums.swing || params.energy * 0.08, 0, 0.24);
    layers.push(
      `s(${q(drumMini(mini.drums?.kick, "bd", 0.9))}).gain(${num(0.78 + params.energy * 0.24)}).cut(1).orbit(1)`,
      `s(${q(drumMini(mini.drums?.snare, "sd", 0.72))}).gain(${num(0.56 + params.energy * 0.22)}).room(${num(room * 0.55)}).orbit(1)`,
      `s(${q(drumMini(mini.drums?.hat, "hh", 0.42))}).gain(${num(0.34 + params.brightness * 0.22)}).hcutoff(1800).orbit(1)`,
    );
    if (mini.drums?.percussion && /[xX.]/.test(mini.drums.percussion)) {
      layers.push(`s(${q(drumMini(mini.drums.percussion, tone === "spring" ? "cp" : "hh", 0.36))}).gain(.36).pan("<.35 .65>").orbit(1)`);
    }
    if (swing > 0.02) {
      layers[layers.length - 1] = `${layers[layers.length - 1]}.swingBy(${num(swing)}, 8)`;
    }
  }

  if (layerEnabled(pattern, "bass")) {
    const bass = noteMini(pattern, mini.bassline, layerOctave(pattern, "bass", 2));
    layers.push(
      `note(${q(bass)}).s(${q(synthFor(vibe, "bass"))}).gain(${num(0.28 + layerDensity(pattern, "bass") * 0.26)}).lpf(${Math.max(380, cutoff - 1900)}).release(.18).orbit(2)`,
    );
  }

  if (layerEnabled(pattern, "pad")) {
    layers.push(
      `note(${q(chordPattern(pattern))}).s(${q(synthFor(vibe, "pad"))}).gain(${num(0.16 + layerDensity(pattern, "pad") * 0.16)}).attack(${num(0.04 + params.space * 0.28)}).release(${num(0.35 + params.space * 0.9)}).lpf(${Math.max(900, cutoff)}).room(${num(room)}).orbit(3)`,
    );
  }

  if (layerEnabled(pattern, "melody")) {
    const melody = noteMini(pattern, mini.melodyMotif, layerOctave(pattern, "melody", 5));
    layers.push(
      `note(${q(melody)}).s(${q(synthFor(vibe, "melody"))}).gain(${num(0.22 + layerDensity(pattern, "melody") * 0.24)}).attack(.01).release(${num(0.18 + params.space * 0.24)}).lpf(${Math.max(1200, cutoff + 700)}).pan("<.42 .58 .5>").orbit(4)`,
    );
  }

  if (layerEnabled(pattern, "arp")) {
    const arp = noteMini(pattern, mini.arpPattern, layerOctave(pattern, "arp", 5));
    layers.push(
      `note(${q(arp)}).s(${q(synthFor(vibe, "arp"))}).gain(${num(0.13 + layerDensity(pattern, "arp") * 0.18)}).attack(.005).release(.12).delay(${num(delay)}).room(${num(room * 0.7)}).pan("<.25 .75 .45 .6>").orbit(5)`,
    );
  }

  const body = layers.length ? layers.join(",\n  ") : `note("c3 e3 g3").s("triangle").gain(.35)`;
  const variation =
    tone === "spring"
      ? ".sometimesBy(.18, x => x.echo(2, 1/8, .42))"
      : tone === "neon"
        ? ".sometimesBy(.22, x => x.jux(rev))"
        : ".sometimesBy(.12, x => x.ply(2).gain(.72))";

  return [
    `stack(\n  ${body}\n)`,
    `.cpm(${num(params.tempo / 4)})`,
    `.gain(${num(0.78 + params.energy * 0.28)})`,
    `.room(${num(room * 0.72)})`,
    `.analyze(1)`,
    variation,
  ].join("\n");
}
