import type { Vibe, VibeParams } from "@/data/vibes";

export interface MixRiskReport {
  score: number;
  layerCount: number;
  gainSum: number;
  maxGain: number;
  globalGain: number;
  variationRisk: number;
  wetness: number;
  issues: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function splitOutsideStrings(code: string) {
  let outside = "";
  let quote: string | null = null;
  let escaped = false;

  for (const char of code) {
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        outside += "\"\"";
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    outside += char;
  }

  return outside;
}

function numericMethodArgs(outsideCode: string, method: string) {
  const values: number[] = [];
  const matcher = new RegExp(`\\.${method}\\s*\\(\\s*([0-9]*\\.?[0-9]+)`, "g");
  let match = matcher.exec(outsideCode);

  while (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) values.push(value);
    match = matcher.exec(outsideCode);
  }

  return values;
}

function countStackLayers(code: string) {
  const start = code.search(/\bstack\s*\(/);
  if (start < 0) return 1;

  const open = code.indexOf("(", start);
  let depth = 0;
  let layers = 1;
  let quote: string | null = null;
  let escaped = false;

  for (let index = open + 1; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) return layers;
      depth -= 1;
    }
    if (char === "," && depth === 0) layers += 1;
  }

  return layers;
}

function globalGainGuess(params: VibeParams) {
  return 0.68 + clamp(params.energy, 0, 1) * 0.1;
}

export function estimateMixRisk(vibe: Vibe): MixRiskReport {
  const code = vibe.pattern?.strudel?.code ?? "";
  const outside = splitOutsideStrings(code);
  const gains = numericMethodArgs(outside, "gain");
  const rooms = numericMethodArgs(outside, "room");
  const delays = numericMethodArgs(outside, "delay");
  const layerCount = countStackLayers(code);
  const globalGain = numericMethodArgs(outside, "postgain").at(-1) ?? globalGainGuess(vibe.params);
  const maxGain = gains.length ? Math.max(...gains) : 0;
  const gainSum = gains.reduce((sum, value) => sum + value, 0) * globalGain;
  const wetness = rooms.reduce((sum, value) => sum + value, 0) + delays.reduce((sum, value) => sum + value * 1.4, 0);
  const variationRisk =
    (/\.\s*(ply|jux|off)\s*\(/.test(outside) ? 0.22 : 0) +
    (/\.\s*echo\s*\(/.test(outside) ? 0.14 : 0) +
    (/\.\s*sometimesBy\s*\(/.test(outside) ? 0.08 : 0);
  const issues: string[] = [];

  if (maxGain > 0.9) issues.push("single-layer-hot");
  if (gainSum > 2.85) issues.push("stack-hot");
  if (globalGain > 0.92) issues.push("master-hot");
  if (variationRisk > 0.28 && gainSum > 2.15) issues.push("hot-variation");
  if (wetness > 2.2 && layerCount > 5) issues.push("wet-dense");

  const penalty =
    Math.max(0, maxGain - 0.82) * 44 +
    Math.max(0, gainSum - 2.35) * 18 +
    Math.max(0, globalGain - 0.86) * 50 +
    Math.max(0, wetness - 2.0) * 8 +
    variationRisk * 24;

  return {
    score: Math.round(clamp(100 - penalty, 0, 100)),
    layerCount,
    gainSum,
    maxGain,
    globalGain,
    variationRisk,
    wetness,
    issues,
  };
}
