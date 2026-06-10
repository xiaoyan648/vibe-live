import type { VibeParams } from "@/data/vibes";

const MAX_STRUDEL_CODE_LENGTH = 5200;

const FORBIDDEN_WORDS = [
  "window",
  "document",
  "globalThis",
  "self",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
  "location",
  "history",
  "open",
  "postMessage",
  "import",
  "require",
  "eval",
  "Function",
  "constructor",
  "prototype",
  "__proto__",
  "class",
  "new",
  "async",
  "await",
  "while",
  "for",
  "if",
  "return",
  "process",
  "Worker",
  "SharedWorker",
];

const ALLOWED_IDENTIFIERS = new Set([
  "stack",
  "cat",
  "seq",
  "note",
  "s",
  "sound",
  "mini",
  "rev",
  "x",
  "p",
  "pat",
  "gain",
  "velocity",
  "vel",
  "bank",
  "n",
  "cut",
  "orbit",
  "room",
  "size",
  "roomsize",
  "delay",
  "delaytime",
  "delayfeedback",
  "lpf",
  "hpf",
  "hcutoff",
  "cutoff",
  "resonance",
  "attack",
  "decay",
  "sustain",
  "release",
  "clip",
  "speed",
  "begin",
  "end",
  "pan",
  "cpm",
  "analyze",
  "fast",
  "slow",
  "swing",
  "swingBy",
  "every",
  "sometimes",
  "sometimesBy",
  "rarely",
  "almostNever",
  "almostAlways",
  "echo",
  "ply",
  "jux",
  "off",
  "late",
  "early",
  "degradeBy",
  "palindrome",
  "iter",
  "iterBack",
  "euclid",
  "euclidRot",
  "struct",
  "mask",
  "transpose",
  "scale",
  "add",
  "sub",
  "mul",
  "div",
]);

function num(value: number, digits = 3) {
  return Number.parseFloat(value.toFixed(digits));
}

function stripStringLiterals(code: string) {
  let output = "";
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
        output += "\"\"";
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    output += char;
  }

  return quote ? null : output;
}

function hasBalancedParens(codeWithoutStrings: string) {
  let depth = 0;
  for (const char of codeWithoutStrings) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function sanitizeStrudelCode(input: string | undefined | null) {
  const code = (input ?? "").trim();
  if (!code || code.length > MAX_STRUDEL_CODE_LENGTH) return null;
  if (/\/\*|\*\/|\/\//.test(code)) return null;

  const outsideStrings = stripStringLiterals(code);
  if (!outsideStrings) return null;
  if (/[;`{}\[\]]/.test(outsideStrings)) return null;
  if (!hasBalancedParens(outsideStrings)) return null;
  if (!/^\s*(stack|note|s|sound|cat|seq)\s*\(/.test(outsideStrings)) return null;

  const identifiers = outsideStrings.match(/[A-Za-z_$][\w$]*/g) ?? [];
  for (const identifier of identifiers) {
    if (FORBIDDEN_WORDS.includes(identifier)) return null;
    if (!ALLOWED_IDENTIFIERS.has(identifier)) return null;
  }

  return code;
}

export function prepareStrudelCode(input: string | undefined | null, params: VibeParams) {
  const code = sanitizeStrudelCode(input);
  if (!code) return null;

  const outsideStrings = stripStringLiterals(code) ?? "";
  const suffixes: string[] = [];
  if (!/\.\s*cpm\s*\(/.test(outsideStrings)) {
    suffixes.push(`.cpm(${num(params.tempo / 4)})`);
  }
  if (!/\.\s*analyze\s*\(/.test(outsideStrings)) {
    suffixes.push(".analyze(1)");
  }

  return [code, ...suffixes].join("\n");
}
