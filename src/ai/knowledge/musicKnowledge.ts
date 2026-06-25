type MoodLike = {
  visual?: unknown;
  scale?: unknown;
  params?: unknown;
  name?: unknown;
  subtitle?: unknown;
  tagline?: unknown;
};

type KnowledgeInput = {
  prompt: string;
  moodPlan: unknown;
  currentVibe?: unknown;
  target?: string;
};

type StyleRecipe = {
  id: string;
  title: string;
  keywords: string[];
  scene: string;
  tempo: string;
  scale: string;
  chords: string;
  groove: string;
  roles: string[];
  motif: string;
  ambience: string;
  strudelHints: string[];
  avoid: string[];
};

type StrudelIdiom = {
  id: string;
  title: string;
  keywords: string[];
  useWhen: string;
  codeHint: string;
  mixGuard: string;
};

const STYLE_RECIPES: StyleRecipe[] = [
  {
    id: "spring-pastoral-pop",
    title: "Spring pastoral ambient pop",
    keywords: ["春", "樱", "花", "清晨", "花园", "草地", "微风", "日光", "pastoral", "garden", "spring"],
    scene: "明亮、轻盈、有空气感的户外场景。",
    tempo: "78-104 BPM, relaxed but not dragging.",
    scale: "major / majorPentatonic / lydian.",
    chords: "Iadd9 / V / vi / IVmaj7, or I / IVmaj7 / V / Iadd9.",
    groove: "light kick on anchors, soft backbeat or rim, sparse hats with rests.",
    roles: [
      "triangle or sine motif in high register, short upward phrase",
      "warm sine/triangle bass with root/fifth movement",
      "thin pad or chord stab, not a heavy drone",
      "very quiet air noise or leaf texture below .035 gain",
    ],
    motif: "Use a 3-5 note upward contour with one small leap; leave the last beat open.",
    ambience: "Low ambience; wind/air is only a transparent edge, not the foreground.",
    strudelHints: [
      'note("g5 ~ b5 d6 ~ a5 ~ e6 ~").s("triangle").gain(.16).delay(.12).room(.18)',
      's("bd ~ ~ ~ [~ sd] ~ ~ ~").gain(.32)',
    ],
    avoid: ["minor-heavy i/VI/III/VII loop", "rain or winter imagery", "long sub drone", "wide dark room"],
  },
  {
    id: "rain-window-lofi",
    title: "Rain-window lo-fi reading",
    keywords: ["雨", "窗", "阅读", "咖啡", "夜雨", "lofi", "lo-fi", "study", "rain", "window"],
    scene: "室内窗边、柔软节拍、雨声在后景。",
    tempo: "68-88 BPM with relaxed swing.",
    scale: "minorPentatonic / dorian / warm major.",
    chords: "im7 / ivm7 / VImaj7 / v, or i / VII / VImaj7 / VII.",
    groove: "loose kick, brushed snare or rim, hats with swing and gaps.",
    roles: [
      "filtered rain noise below melody",
      "muted triangle bass, root plus color tone",
      "soft sine pad with minor seventh color",
      "short descending triangle motif",
    ],
    motif: "A two-bar call-and-answer phrase; answer should not be identical to call.",
    ambience: "Rain can be audible but should sit behind the motif and kick.",
    strudelHints: [
      's("bd ~ ~ bd ~ sd ~ ~").gain(.34).swingBy(.18,4)',
      'note("f5 ~ eb5 c5 ~ ab4 ~ c5 ~").s("triangle").gain(.13).delay(.18).room(.32)',
    ],
    avoid: ["high brightness with no warmth", "continuous white-noise wash", "all layers hitting on beat 1"],
  },
  {
    id: "neon-afterhours-pulse",
    title: "Neon afterhours pulse",
    keywords: ["霓虹", "代码", "赛博", "城市", "午夜", "凌晨", "键盘", "neon", "code", "afterhours", "cyber"],
    scene: "城市夜色、玻璃、键盘脉冲，精确但不吵。",
    tempo: "94-124 BPM, stable pulse.",
    scale: "dorian / minorPentatonic.",
    chords: "i / ivm7 / VImaj7 / VII, compact voicings.",
    groove: "tight kick, dry snare, closed hats, syncopated bass cuts.",
    roles: [
      "filtered saw bass for low-grid movement",
      "sine or triangle lead for clean neon tag",
      "thin pad, short release",
      "tiny city-noise bed below .025 gain",
    ],
    motif: "Use a repeatable three-note tag, then one chromatic-feeling answer via scale degrees.",
    ambience: "Low city air only; avoid washing out the pulse.",
    strudelHints: [
      's("bd ~ bd ~ ~ sd bd ~").gain(.42).cut(1)',
      'note("c2 ~ c2 eb2 ~ g2 eb2 ~").s("sawtooth").lpf(720).gain(.22)',
    ],
    avoid: ["pad filling every beat", "huge reverb tail", "same lo-fi hat loop as rain scenes"],
  },
  {
    id: "forest-organic-ambient",
    title: "Forest organic ambient walk",
    keywords: ["森林", "苔藓", "湿土", "鸟", "树", "林间", "散步", "forest", "moss", "birds", "wood"],
    scene: "近距离自然声、木质脉冲、步伐感。",
    tempo: "70-94 BPM, human walking pace.",
    scale: "majorPentatonic / dorian.",
    chords: "I / V / vi / IV, or i / IV / VII / i for shaded forest.",
    groove: "soft percussion like footsteps; drums can be minimal.",
    roles: [
      "woodblock-like percussion or very soft hat pattern",
      "round triangle bass in low-mid register",
      "pentatonic motif, bird-like but not random",
      "filtered noise as leaves or distance",
    ],
    motif: "Use pentatonic skips and rests; never dense chromatic runs.",
    ambience: "Leaf/air texture can breathe, but gains stay very low.",
    strudelHints: [
      'note("g5 ~ b5 ~ d6 b5 ~ g5").s("triangle").gain(.12).pan(.2).room(.24)',
      's("~ hh ~ ~ hh ~ ~ cp").gain(.12).degradeBy(.18)',
    ],
    avoid: ["urban kick dominance", "cold synthetic drone", "random high notes without phrase"],
  },
  {
    id: "cosmic-meditation",
    title: "Cosmic meditation drift",
    keywords: ["宇宙", "星云", "漂浮", "冥想", "深空", "银河", "cosmos", "space", "meditation", "float"],
    scene: "无重力、长呼吸、少量星点动机。",
    tempo: "42-72 BPM or slow cpm feeling.",
    scale: "dorian / minorPentatonic / lydian for brighter space.",
    chords: "i / IV / i / VII, or Imaj7 / II / V / I for luminous space.",
    groove: "beatless or extremely sparse pulse; motif must prevent pure drone.",
    roles: [
      "long sine pad in wide register",
      "sub pulse with many rests",
      "tiny triangle star motif",
      "low noise bed under .02 gain",
    ],
    motif: "A repeating point of light every 1-2 bars; keep high notes short.",
    ambience: "Space is room depth plus silence, not loud noise.",
    strudelHints: [
      'note("c5 ~ ~ g4 ~ d5 ~ ~").s("triangle").gain(.1).delay(.32).room(.48)',
      'note("c2 ~ ~ ~ ~ g1 ~ ~").s("sine").gain(.14).release(.8)',
    ],
    avoid: ["only one endless pad", "dense drums", "ambience above foreground"],
  },
  {
    id: "deep-focus-minimal",
    title: "Deep-focus minimal desk groove",
    keywords: ["专注", "学习", "写作", "阅读", "办公室", "台灯", "focus", "study", "work", "desk"],
    scene: "稳定、低干扰、重复中有微小变化。",
    tempo: "76-98 BPM, steady.",
    scale: "minorPentatonic / dorian / majorPentatonic.",
    chords: "i / VII / VImaj7 / VII, or I / V / vi / IV with close voicings.",
    groove: "small kick, low snare, hats never too bright.",
    roles: [
      "short bass cell with one variation every 2 bars",
      "soft pad as low-contrast glue",
      "minimal motif with low note count",
      "arp only if it does not distract",
    ],
    motif: "Two or three notes, repeated with one delayed answer.",
    ambience: "Room tone very low; no foreground environmental narrative unless requested.",
    strudelHints: [
      'note("g4 ~ c5 ~ eb5 ~ c5 ~").s("triangle").gain(.12).delay(.1)',
      's("bd ~ ~ ~ ~ sd ~ ~").gain(.28).swingBy(.1,4)',
    ],
    avoid: ["high-density arp", "large fills", "strong emotional chord turns"],
  },
  {
    id: "summer-memory-citypop",
    title: "Summer memory city-pop haze",
    keywords: ["夏", "汽水", "蝉", "旧巷", "怀旧", "黄昏", "summer", "cicada", "nostalgia", "citypop"],
    scene: "暖色回忆、轻快贝斯、清亮主旋律。",
    tempo: "92-116 BPM, gentle bounce.",
    scale: "major / majorPentatonic.",
    chords: "Imaj7 / vi7 / IVmaj7 / Vsus4, or Iadd9 / iii / vi / IV.",
    groove: "soft four-on-floor or pop backbeat, with syncopated bass.",
    roles: [
      "round bass with octave or fifth motion",
      "bright triangle motif like a remembered hook",
      "warm pad/chord stabs",
      "cicada-like high noise below .03 gain if requested",
    ],
    motif: "A hummable hook with a repeated starting note and a lifted ending.",
    ambience: "Cicadas are texture, not a loud sample layer.",
    strudelHints: [
      'note("e5 e5 g5 b5 ~ a5 g5 ~").s("triangle").gain(.15).delay(.16)',
      'note("c2 ~ g2 ~ a2 ~ f2 g2").s("sine").gain(.24)',
    ],
    avoid: ["washed beige pad only", "sad winter minor palette", "too much hiss on bright scenes"],
  },
  {
    id: "coastal-downtempo",
    title: "Coastal downtempo",
    keywords: ["海", "浪", "沙滩", "海边", "潮汐", "蓝色", "coast", "ocean", "wave", "beach"],
    scene: "水平线、慢速律动、潮汐呼吸。",
    tempo: "72-96 BPM.",
    scale: "majorPentatonic / lydian / dorian for dusk.",
    chords: "Iadd9 / V / IVmaj7 / V, or i / VII / IV / i for darker coast.",
    groove: "kick as slow step, hats sparse, percussion like shells.",
    roles: [
      "filtered noise as surf, below .045 gain",
      "sine bass with slow root/fifth motion",
      "wide pad with short enough release",
      "clear high motif with wave-like return",
    ],
    motif: "Rise for two notes, fall for two notes; keep it circular.",
    ambience: "Surf can be present but must not mask chord and motif.",
    strudelHints: [
      'note("a2 ~ e3 ~ f#3 ~ e3 ~").s("sine").gain(.2)',
      'note("c6 ~ a5 e5 ~ a5 ~ g5 ~").s("triangle").gain(.12).room(.28)',
    ],
    avoid: ["storm interpretation unless requested", "all low-pass murk", "ambience louder than melody"],
  },
  {
    id: "winter-room-minimal",
    title: "Winter room minimal",
    keywords: ["冬", "雪", "冷", "房间", "清冷", "夜雪", "winter", "snow", "cold"],
    scene: "冷空气、室内灯、克制孤独。",
    tempo: "56-82 BPM.",
    scale: "minorPentatonic / dorian.",
    chords: "i / VImaj7 / III / VII, or i / ivm7 / VII / i.",
    groove: "sparse pulse or no snare; avoid busy hats.",
    roles: [
      "soft sine sub with long rests",
      "thin pad in mid-high register",
      "small glassy motif",
      "cold air noise below .025 gain",
    ],
    motif: "Short descending phrase with a held rest after it.",
    ambience: "Cold air is silence and light hiss, not a storm unless asked.",
    strudelHints: [
      'note("d4 ~ a3 ~ e4 ~ ~ a3").s("triangle").gain(.11).room(.34)',
      's("bd ~ ~ ~ ~ ~ ~ ~").gain(.2)',
    ],
    avoid: ["bright spring chords", "dance kick", "constant melody without silence"],
  },
  {
    id: "tea-ceremony-organic",
    title: "Tea ceremony organic minimal",
    keywords: ["茶", "禅", "竹", "庭院", "水滴", "安静", "tea", "zen", "bamboo"],
    scene: "克制、留白、木石水的触感。",
    tempo: "48-76 BPM.",
    scale: "majorPentatonic / minorPentatonic.",
    chords: "I / V / vi / I, or i / VII / i / IV with open intervals.",
    groove: "mostly beatless; tiny percussive dots.",
    roles: [
      "pentatonic high motif, very sparse",
      "low sine anchor every 1-2 bars",
      "soft pad or silence as harmony",
      "water/air noise below .02 gain",
    ],
    motif: "Two-note gesture plus a long rest; do not fill the space.",
    ambience: "Use restraint; silence is part of the arrangement.",
    strudelHints: [
      'note("c6 ~ ~ g5 ~ ~ e5 ~").s("triangle").gain(.095).delay(.2)',
      'note("c2 ~ ~ ~ g1 ~ ~ ~").s("sine").gain(.12).release(.7)',
    ],
    avoid: ["busy arp", "club drums", "large romantic chord progression"],
  },
  {
    id: "retro-synthwave-lite",
    title: "Retro synthwave lite",
    keywords: ["复古", "合成器", "公路", "霓虹", "胶片", "retro", "synthwave", "drive"],
    scene: "复古公路、模拟合成器，但保持氛围而非强 EDM。",
    tempo: "88-112 BPM.",
    scale: "minor / dorian.",
    chords: "i / VI / III / VII, or i / ivm7 / VImaj7 / V.",
    groove: "steady kick, gated snare, offbeat hat at moderate gain.",
    roles: [
      "saw bass with lpf, short notes",
      "triangle/sine lead to avoid harshness",
      "retro pad with controlled room",
      "tape hiss below .02 gain",
    ],
    motif: "Simple lead hook with octave answer; avoid maximal arps.",
    ambience: "Tape glow is subtle; no wall of detuned saws.",
    strudelHints: [
      'note("c2 ~ g2 ~ eb2 ~ g2 ~").s("sawtooth").lpf(680).gain(.22)',
      'note("g5 eb5 ~ c5 bb4 ~ c5 ~").s("triangle").gain(.14).delay(.14)',
    ],
    avoid: ["harsh full-range saw stack", "postgain above .86", "too many simultaneous arps"],
  },
  {
    id: "soft-house-gallery",
    title: "Soft house gallery loop",
    keywords: ["画廊", "酒吧", "走廊", "轻舞", "house", "gallery", "lounge", "bar"],
    scene: "优雅室内、轻微舞动、不过分商业。",
    tempo: "104-122 BPM.",
    scale: "dorian / minorPentatonic / major for warm lounge.",
    chords: "im7 / IV / VII / i, or Imaj7 / vi / IV / V.",
    groove: "four-on-floor softened by low gain, hats and clap with air.",
    roles: [
      "quiet four-on-floor kick",
      "short bass pulse with syncopation",
      "chord stab instead of long pad",
      "small motif or arp for polish",
    ],
    motif: "One-bar hook, repeated with light variation.",
    ambience: "Room is refined, not club wash.",
    strudelHints: [
      's("bd bd bd bd").gain(.36).cut(1)',
      'note("c3 ~ eb3 g3 ~ bb2 ~ g2").s("sawtooth").lpf(620).gain(.19)',
    ],
    avoid: ["loud kick", "festival snare", "dense supersaw"],
  },
];

const STRUDEL_IDIOMS: StrudelIdiom[] = [
  {
    id: "safe-stack-roles",
    title: "Role-separated stack",
    keywords: ["all", "任何", "默认", "composer"],
    useWhen: "Always. Build 5-6 layers with a unique role per layer: ambience, drums, bass, chords, motif, optional counter.",
    codeHint: 'stack(s("bd ~ ~ sd").gain(.3), note("c2 ~ g2 ~").s("sine").gain(.2), note("e5 ~ g5 ~").s("triangle").gain(.14)).compressor("-18:6:18:.005:.18").postgain(.84)',
    mixGuard: "One foreground layer only; ambience below .06; postgain .80-.86.",
  },
  {
    id: "phrase-memory",
    title: "Memorable motif phrase",
    keywords: ["melody", "motif", "旋律", "记忆", "hook", "春", "夏", "霓虹"],
    useWhen: "When the loop feels generic or lacks a reason to keep listening.",
    codeHint: 'note("g5 ~ b5 d6 ~ a5 ~ e6 ~").s("triangle").gain(.13).delay(.14).room(.22)',
    mixGuard: "Motif gain .10-.18; delay feedback should not create a second lead.",
  },
  {
    id: "syncopated-bass",
    title: "Root-and-fifth bass motion",
    keywords: ["bass", "低音", "groove", "律动", "house", "neon", "focus"],
    useWhen: "When bass is a static drone or does not support the groove.",
    codeHint: 'note("c2 ~ g2 ~ eb2 ~ g2 ~").s("sawtooth").lpf(640).gain(.2).cut(2)',
    mixGuard: "Bass gain .16-.28; low-pass saw bass; leave rests around kick.",
  },
  {
    id: "loose-lofi-drums",
    title: "Loose lo-fi drum pocket",
    keywords: ["lofi", "lo-fi", "rain", "雨", "阅读", "study"],
    useWhen: "For reading/rain/study loops that need human looseness.",
    codeHint: 's("bd ~ ~ bd ~ sd ~ ~").gain(.32).swingBy(.16,4).room(.12)',
    mixGuard: "Kick/snare should not share every bass hit; keep hats lower than melody.",
  },
  {
    id: "neon-pulse-drums",
    title: "Precise neon pulse",
    keywords: ["neon", "霓虹", "code", "代码", "city", "城市"],
    useWhen: "For city/code scenes where pulse clarity matters.",
    codeHint: 's("bd ~ bd ~ ~ sd bd ~").gain(.38).cut(1)',
    mixGuard: "Use dry room and short tails; avoid stacking multiple bright hats.",
  },
  {
    id: "quiet-noise-texture",
    title: "Quiet environmental texture",
    keywords: ["雨", "风", "海", "森林", "宇宙", "城市", "ambience", "noise", "空气"],
    useWhen: "When scene needs environment sound without masking music.",
    codeHint: 'note("c6 ~ ~ ~ g5 ~ ~ ~").s("triangle").noise(.018).gain(.035).hpf(900).lpf(4200).room(.32).orbit(6)',
    mixGuard: "Texture gain .01-.05; if ambience role is present, foreground must be motif/kick/bass, not noise.",
  },
  {
    id: "sparkle-arp",
    title: "Sparse sparkle arp",
    keywords: ["arp", "闪烁", "星", "玻璃", "focus", "space", "霓虹"],
    useWhen: "When a track needs motion but should stay elegant.",
    codeHint: 'note("c5 e5 g5 b5 ~ g5 e5 ~").s("triangle").gain(.095).ply(2).delay(.1)',
    mixGuard: "Arp gain below motif; use rests or lower density if melody is active.",
  },
  {
    id: "call-answer-counter",
    title: "Call-and-answer counter line",
    keywords: ["丰富", "counter", "answer", "对答", "不单调", "variation"],
    useWhen: "When the loop is too repetitive but the main motif is already clear.",
    codeHint: 'note("~ ~ e5 ~ g5 ~ ~ d5").s("sine").gain(.075).pan(-.18).delay(.12)',
    mixGuard: "Countermelody gain must be lower than motif; place it in rests.",
  },
  {
    id: "controlled-space",
    title: "Controlled room and delay",
    keywords: ["space", "room", "delay", "混响", "空间", "宇宙", "雨"],
    useWhen: "When spatial mood is important but loudness needs headroom.",
    codeHint: 'note("c4 e4 g4 b4").s("sine").gain(.12).attack(.04).release(.65).room(.28).delay(.12)',
    mixGuard: "Avoid room > .65 on several layers; wet ambience plus echo can cause perceived volume jumps.",
  },
  {
    id: "safe-master",
    title: "Safe mastering suffix",
    keywords: ["all", "任何", "master", "响度", "loudness"],
    useWhen: "Always end playable Strudel with transport and mastering.",
    codeHint: '.cpm(tempo/4).compressor("-18:6:18:.005:.18").postgain(.82).analyze(1)',
    mixGuard: "Do not exceed postgain .86; lower layer gains when using ply, jux, echo, or dense hats.",
  },
];

const MOOD_SCALE_BOOST: Record<string, string[]> = {
  major: ["spring-pastoral-pop", "summer-memory-citypop", "coastal-downtempo", "soft-house-gallery"],
  majorPentatonic: ["spring-pastoral-pop", "forest-organic-ambient", "tea-ceremony-organic", "coastal-downtempo"],
  lydian: ["spring-pastoral-pop", "cosmic-meditation", "coastal-downtempo"],
  dorian: ["neon-afterhours-pulse", "cosmic-meditation", "forest-organic-ambient", "soft-house-gallery"],
  minorPentatonic: ["rain-window-lofi", "deep-focus-minimal", "winter-room-minimal", "retro-synthwave-lite"],
  minor: ["retro-synthwave-lite", "winter-room-minimal", "neon-afterhours-pulse"],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function moodText(moodPlan: unknown, currentVibe?: unknown) {
  const mood = asRecord(moodPlan) as MoodLike;
  const vibe = asRecord(currentVibe);
  return [
    textOf(mood.name),
    textOf(mood.subtitle),
    textOf(mood.tagline),
    textOf(mood.visual),
    textOf(mood.scale),
    textOf(vibe.name),
    textOf(vibe.subtitle),
    textOf(vibe.tagline),
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeText(input: string) {
  return input.toLowerCase();
}

function scoreByKeywords(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => {
    const needle = keyword.toLowerCase();
    if (!needle) return score;
    return text.includes(needle) ? score + (needle.length > 1 ? 4 : 2) : score;
  }, 0);
}

function getMoodScale(moodPlan: unknown) {
  const scale = asRecord(moodPlan).scale;
  return typeof scale === "string" ? scale : "";
}

function getMoodTempo(moodPlan: unknown) {
  const params = asRecord(asRecord(moodPlan).params);
  const tempo = params.tempo;
  return typeof tempo === "number" ? tempo : undefined;
}

function recipeScore(recipe: StyleRecipe, inputText: string, scale: string, tempo: number | undefined) {
  let score = scoreByKeywords(inputText, recipe.keywords);

  if (scale && MOOD_SCALE_BOOST[scale]?.includes(recipe.id)) {
    score += 3;
  }

  if (typeof tempo === "number") {
    const [low, high] = recipe.tempo.match(/\d+/g)?.slice(0, 2).map(Number) ?? [];
    if (low && high && tempo >= low - 8 && tempo <= high + 8) score += 1;
  }

  if (recipe.id.includes("focus") && /专注|学习|阅读|focus|study|work/.test(inputText)) score += 4;
  if (recipe.id.includes("cosmic") && /冥想|漂浮|宇宙|space|meditation/.test(inputText)) score += 4;
  if (recipe.id.includes("spring") && /春|樱|花|清晨|日光/.test(inputText)) score += 5;

  return score;
}

function selectStyleRecipes(input: KnowledgeInput) {
  const text = normalizeText(`${input.prompt} ${moodText(input.moodPlan, input.currentVibe)} ${input.target ?? ""}`);
  const scale = getMoodScale(input.moodPlan);
  const tempo = getMoodTempo(input.moodPlan);
  const scored = STYLE_RECIPES.map((recipe) => ({
    recipe,
    score: recipeScore(recipe, text, scale, tempo),
  })).sort((a, b) => b.score - a.score);

  const selected = scored.filter((item) => item.score > 0).slice(0, 4).map((item) => item.recipe);
  if (selected.length >= 3) return selected;

  const defaults = ["deep-focus-minimal", "spring-pastoral-pop", "rain-window-lofi", "neon-afterhours-pulse"]
    .map((id) => STYLE_RECIPES.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is StyleRecipe => Boolean(recipe));

  return [...selected, ...defaults.filter((recipe) => !selected.some((item) => item.id === recipe.id))].slice(0, 4);
}

function selectStrudelIdioms(input: KnowledgeInput, selectedRecipes: StyleRecipe[]) {
  const text = normalizeText(
    `${input.prompt} ${moodText(input.moodPlan, input.currentVibe)} ${input.target ?? ""} ${selectedRecipes
      .map((recipe) => `${recipe.id} ${recipe.title}`)
      .join(" ")}`,
  );
  const required = ["safe-stack-roles", "safe-master"];
  const scored = STRUDEL_IDIOMS.map((idiom) => ({
    idiom,
    score: scoreByKeywords(text, idiom.keywords) + (required.includes(idiom.id) ? 99 : 0),
  })).sort((a, b) => b.score - a.score);

  return scored
    .filter((item) => item.score > 0)
    .slice(0, 7)
    .map((item) => item.idiom);
}

function formatRecipe(recipe: StyleRecipe) {
  return [
    `- ${recipe.title}: scene=${recipe.scene}`,
    `  tempo=${recipe.tempo}; scale=${recipe.scale}; chords=${recipe.chords}`,
    `  groove=${recipe.groove}`,
    `  roles=${recipe.roles.join(" | ")}`,
    `  motif=${recipe.motif}`,
    `  ambience=${recipe.ambience}`,
    `  Strudel hints=${recipe.strudelHints.join(" || ")}`,
    `  avoid=${recipe.avoid.join(" / ")}`,
  ].join("\n");
}

function formatIdiom(idiom: StrudelIdiom) {
  return [
    `- ${idiom.title}: ${idiom.useWhen}`,
    `  code hint=${idiom.codeHint}`,
    `  mix guard=${idiom.mixGuard}`,
  ].join("\n");
}

export function buildComposerKnowledgeContext(input: KnowledgeInput) {
  const recipes = selectStyleRecipes(input);
  const idioms = selectStrudelIdioms(input, recipes);

  return [
    "本地音乐知识库（按当前场景检索，作为创作参考，不要照抄标题或说明）：",
    "",
    "曲风 / 场景 recipe：",
    ...recipes.map(formatRecipe),
    "",
    "Strudel 安全写法 idioms：",
    ...idioms.map(formatIdiom),
    "",
    "使用要求：",
    "- 从 recipe 中选择最贴合用户描述的一条作为主方向，另一条只借鉴局部手法。",
    "- strudel.code 仍必须满足安全白名单、单表达式、stack(...)、.cpm、.compressor、.postgain、.analyze。",
    "- 不要复刻任何真实歌曲；只借鉴 tempo、和声色彩、编曲角色、groove 与混音约束。",
  ].join("\n");
}

export const musicKnowledgeForTests = {
  recipes: STYLE_RECIPES,
  idioms: STRUDEL_IDIOMS,
  selectStyleRecipes,
  selectStrudelIdioms,
};
