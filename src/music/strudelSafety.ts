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
  "postgain",
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
  "compressor",
  "compressorRatio",
  "compressorKnee",
  "compressorAttack",
  "compressorRelease",
  "lpf",
  "hpf",
  "hcutoff",
  "cutoff",
  "resonance",
  "noise",
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

function extractStringLiterals(code: string) {
  const strings: string[] = [];
  let value = "";
  let quote: string | null = null;
  let escaped = false;

  for (const char of code) {
    if (quote) {
      if (escaped) {
        value += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        strings.push(value);
        value = "";
        quote = null;
        continue;
      }
      value += char;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
    }
  }

  return quote ? null : strings;
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

function getCallArgumentLists(codeWithoutStrings: string, name: string) {
  const args: string[] = [];
  const matcher = new RegExp(`\\.\\s*${name}\\s*\\(`, "g");
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(codeWithoutStrings))) {
    const start = matcher.lastIndex;
    let depth = 1;

    for (let index = start; index < codeWithoutStrings.length; index += 1) {
      const char = codeWithoutStrings[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;

      if (depth === 0) {
        args.push(codeWithoutStrings.slice(start, index));
        matcher.lastIndex = index + 1;
        break;
      }
    }

    if (depth !== 0) return null;
  }

  return args;
}

function countTopLevelArguments(args: string) {
  const trimmed = args.trim();
  if (!trimmed) return 0;

  let depth = 0;
  let count = 1;

  for (const char of trimmed) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) count += 1;
  }

  return count;
}

function hasValidMethodArities(codeWithoutStrings: string) {
  const strictArities = {
    swingBy: 2,
    sometimesBy: 2,
  } as const;

  for (const [name, arity] of Object.entries(strictArities)) {
    const calls = getCallArgumentLists(codeWithoutStrings, name);
    if (!calls) return false;
    if (calls.some((args) => countTopLevelArguments(args) !== arity)) return false;
  }

  return true;
}

function hasBalancedMiniSyntax(pattern: string) {
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    "]": "[",
    ")": "(",
    "}": "{",
    ">": "<",
  };
  const opens = new Set(Object.values(pairs));

  for (const char of pattern) {
    if (opens.has(char)) {
      stack.push(char);
      continue;
    }

    const expected = pairs[char];
    if (!expected) continue;
    if (stack.pop() !== expected) return false;
  }

  return stack.length === 0;
}

export function sanitizeStrudelCode(input: string | undefined | null) {
  const code = (input ?? "")
    .trim()
    .replace(/\\+r\\+n|\\+n|\\+r/g, "\n")
    .replace(/\\+t/g, "  ")
    .replace(/\\+"/g, "\"");
  if (!code || code.length > MAX_STRUDEL_CODE_LENGTH) return null;
  if (/\/\*|\*\/|\/\//.test(code)) return null;

  const outsideStrings = stripStringLiterals(code);
  if (!outsideStrings) return null;
  const stringLiterals = extractStringLiterals(code);
  if (!stringLiterals || stringLiterals.some((value) => !hasBalancedMiniSyntax(value))) return null;
  if (/[;`{}\[\]]/.test(outsideStrings)) return null;
  if (!hasBalancedParens(outsideStrings)) return null;
  if (!hasValidMethodArities(outsideStrings)) return null;
  if (!/^\s*(stack|note|s|sound|cat|seq)\s*\(/.test(outsideStrings)) return null;

  const identifiers = outsideStrings.match(/[A-Za-z_$][\w$]*/g) ?? [];
  for (const identifier of identifiers) {
    if (FORBIDDEN_WORDS.includes(identifier)) return null;
    if (!ALLOWED_IDENTIFIERS.has(identifier)) return null;
  }

  return code;
}

interface PrepareStrudelCodeOptions {
  includeMastering?: boolean;
  includeTransport?: boolean;
}

export function prepareStrudelCode(
  input: string | undefined | null,
  params: VibeParams,
  options: PrepareStrudelCodeOptions = {},
) {
  const code = sanitizeStrudelCode(input);
  if (!code) return null;

  const outsideStrings = stripStringLiterals(code) ?? "";
  const suffixes: string[] = [];
  if (options.includeMastering !== false && !/\.\s*compressor\s*\(/.test(outsideStrings)) {
    suffixes.push('.compressor("-18:6:18:.005:.18")');
  }
  if (options.includeMastering !== false && !/\.\s*postgain\s*\(/.test(outsideStrings)) {
    suffixes.push(".postgain(.84)");
  }
  if (options.includeTransport !== false && !/\.\s*cpm\s*\(/.test(outsideStrings)) {
    suffixes.push(`.cpm(${num(params.tempo / 4)})`);
  }
  if (options.includeTransport !== false && !/\.\s*analyze\s*\(/.test(outsideStrings)) {
    suffixes.push(".analyze(1)");
  }

  return [code, ...suffixes].join("\n");
}
