import { getChordNotes, getScaleNotes } from "./scheduler";
import { getTextureProfile, type TextureProfile } from "./texture";
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

function textureFilter(profile: TextureProfile) {
  if (profile.filterType === "highpass") {
    return `.hpf(${Math.round(profile.cutoff)})`;
  }
  if (profile.filterType === "bandpass") {
    const low = Math.max(80, Math.round(profile.cutoff * 0.62));
    const high = Math.round(profile.cutoff * 1.72);
    return `.hpf(${low}).lpf(${high})`;
  }
  return `.lpf(${Math.round(profile.cutoff)})`;
}

function textureLayer(vibe: Vibe, params: VibeParams) {
  const profile = getTextureProfile(vibe, params);
  if (profile.kind === "none" || profile.gain <= 0.001) return null;

  const note =
    profile.kind === "rain"
      ? "c5 ~ c5 ~ c5 ~ c5 ~"
      : profile.kind === "city"
        ? "c3 ~ ~ c3 ~ c3 ~ ~"
        : profile.kind === "space"
          ? "c2 ~ ~ ~ c3 ~ ~ ~"
          : "c4 ~ ~ c4 ~ ~ c4 ~";
  const pan =
    profile.kind === "rain"
      ? "<.2 .8 .4 .65>"
      : profile.kind === "city"
        ? "<.35 .55 .72 .28>"
        : "<.42 .58 .48 .62>";
  const gain = clamp(profile.gain, 0.006, 0.055);
  const noise = profile.noise === "white" ? 0.82 : profile.noise === "brown" ? 0.54 : 0.68;
  const release = profile.kind === "space" || profile.kind === "wind" ? 1.2 : 0.72;

  return `note(${q(note)}).s("triangle").noise(${num(noise)}).gain(${num(gain)}).attack(.08).release(${num(release)})${textureFilter(profile)}.room(${num(clamp(params.space * 0.32, 0.06, 0.26))}).pan(${q(pan)}).orbit(6)`;
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
    const nativeCode = prepareStrudelCode(pattern.strudel?.code, params, {
      includeMastering: false,
      includeTransport: false,
    });
    if (nativeCode) {
      const texture = textureLayer(vibe, params);
      const body = texture ? `stack(\n  ${nativeCode},\n  ${texture}\n)` : nativeCode;
      return [
        body,
        `.cpm(${num(params.tempo / 4)})`,
        `.compressor("-18:6:18:.005:.18")`,
        ".postgain(.84)",
        ".analyze(1)",
      ].join("\n");
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
      `s(${q(drumMini(mini.drums?.kick, "bd", 0.72))}).gain(${num(0.48 + params.energy * 0.16)}).cut(1).orbit(1)`,
      `s(${q(drumMini(mini.drums?.snare, "sd", 0.54))}).gain(${num(0.3 + params.energy * 0.13)}).room(${num(room * 0.48)}).orbit(1)`,
      `s(${q(drumMini(mini.drums?.hat, "hh", 0.32))}).gain(${num(0.18 + params.brightness * 0.12)}).hcutoff(1800).orbit(1)`,
    );
    if (mini.drums?.percussion && /[xX.]/.test(mini.drums.percussion)) {
      layers.push(`s(${q(drumMini(mini.drums.percussion, tone === "spring" ? "cp" : "hh", 0.24))}).gain(.16).pan("<.35 .65>").orbit(1)`);
    }
    if (swing > 0.02) {
      layers[layers.length - 1] = `${layers[layers.length - 1]}.swingBy(${num(swing)}, 8)`;
    }
  }

  if (layerEnabled(pattern, "bass")) {
    const bass = noteMini(pattern, mini.bassline, layerOctave(pattern, "bass", 2));
    layers.push(
      `note(${q(bass)}).s(${q(synthFor(vibe, "bass"))}).gain(${num(0.18 + layerDensity(pattern, "bass") * 0.16)}).lpf(${Math.max(380, cutoff - 1900)}).release(.18).orbit(2)`,
    );
  }

  if (layerEnabled(pattern, "pad")) {
    layers.push(
      `note(${q(chordPattern(pattern))}).s(${q(synthFor(vibe, "pad"))}).gain(${num(0.1 + layerDensity(pattern, "pad") * 0.12)}).attack(${num(0.04 + params.space * 0.28)}).release(${num(0.35 + params.space * 0.9)}).lpf(${Math.max(900, cutoff)}).room(${num(room)}).orbit(3)`,
    );
  }

  if (layerEnabled(pattern, "melody")) {
    const melody = noteMini(pattern, mini.melodyMotif, layerOctave(pattern, "melody", 5));
    layers.push(
      `note(${q(melody)}).s(${q(synthFor(vibe, "melody"))}).gain(${num(0.14 + layerDensity(pattern, "melody") * 0.15)}).attack(.01).release(${num(0.18 + params.space * 0.24)}).lpf(${Math.max(1200, cutoff + 700)}).pan("<.42 .58 .5>").orbit(4)`,
    );
  }

  if (layerEnabled(pattern, "arp")) {
    const arp = noteMini(pattern, mini.arpPattern, layerOctave(pattern, "arp", 5));
    layers.push(
      `note(${q(arp)}).s(${q(synthFor(vibe, "arp"))}).gain(${num(0.08 + layerDensity(pattern, "arp") * 0.11)}).attack(.005).release(.12).delay(${num(delay)}).room(${num(room * 0.7)}).pan("<.25 .75 .45 .6>").orbit(5)`,
    );
  }

  const texture = textureLayer(vibe, params);
  if (texture) {
    layers.push(texture);
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
    `.gain(${num(0.66 + params.energy * 0.12)})`,
    `.room(${num(room * 0.72)})`,
    `.compressor("-18:6:18:.005:.18")`,
    `.postgain(.84)`,
    `.analyze(1)`,
    variation,
  ].join("\n");
}
