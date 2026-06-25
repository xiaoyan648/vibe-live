"use client";

import { type CSSProperties, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getVibeAudioEngine } from "@/audio/engine";
import { decodeVibeFromHash, loadSavedVibes, removeSavedVibeFromLibrary, saveVibeToLibrary } from "@/data/persistence";
import { VIBES, type Vibe, type VibeParams } from "@/data/vibes";
import VibeBackground from "@/components/VibeBackground";
import PlayerView from "@/components/PlayerView";
import VibePrompt from "@/components/VibePrompt";
import {
  DEFAULT_USER_AI_CONFIG,
  hasUsableImageToolConfig,
  hasUsableUserAiConfig,
  loadUserAiConfig,
  saveUserAiConfig,
  type UserAiConfig,
} from "@/ai/userConfig";
import { enforceMusicQuality } from "@/music/quality";

// 首页用一个"中性"的氛围给背景画布打底
const HOME_VIBE = VIBES[VIBES.length - 1]; // cosmic-drift

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function averageBand(values: number[], start: number, end: number) {
  const cappedEnd = Math.min(values.length, end);
  if (cappedEnd <= start) return 0;

  let sum = 0;
  for (let index = start; index < cappedEnd; index += 1) {
    sum += values[index] ?? 0;
  }
  return sum / (cappedEnd - start) / 255;
}

function cssImageUrl(url?: string) {
  if (!url) return undefined;
  return `url("${url.replace(/["\\\n\r]/g, "")}")`;
}

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb | null {
  const value = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(value)) return null;
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function relativeLuminance(hex: string) {
  const rgb = parseHexColor(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function readableThemeVars(base: string) {
  const isLight = relativeLuminance(base) > 0.48;
  const ink = isLight ? { r: 31, g: 36, b: 28 } : { r: 232, g: 238, b: 226 };
  const inverse = isLight ? { r: 245, g: 247, b: 238 } : { r: 5, g: 12, b: 8 };
  const shadow = isLight ? { r: 32, g: 34, b: 28 } : { r: 0, g: 0, b: 0 };

  return {
    ["--gallery-ink" as string]: rgba(ink, isLight ? 0.86 : 0.88),
    ["--gallery-muted" as string]: rgba(ink, isLight ? 0.66 : 0.58),
    ["--gallery-faint" as string]: rgba(ink, isLight ? 0.42 : 0.34),
    ["--gallery-line" as string]: rgba(ink, isLight ? 0.18 : 0.14),
    ["--gallery-line-strong" as string]: rgba(ink, isLight ? 0.34 : 0.32),
    ["--gallery-surface" as string]: rgba(shadow, isLight ? 0.1 : 0.12),
    ["--gallery-surface-hover" as string]: rgba(ink, isLight ? 0.09 : 0.07),
    ["--gallery-primary-bg" as string]: rgba(ink, isLight ? 0.78 : 0.82),
    ["--gallery-primary-bg-hover" as string]: rgba(ink, isLight ? 0.86 : 0.9),
    ["--gallery-primary-text" as string]: rgba(inverse, isLight ? 0.92 : 0.94),
    ["--gallery-depth" as string]: isLight ? "#f2ecdc" : "#02220f",
    ["--gallery-base-weight" as string]: isLight ? "74%" : "86%",
    ["--gallery-vignette-edge" as string]: rgba(shadow, isLight ? 0.2 : 0.32),
    ["--gallery-vignette-bottom" as string]: rgba(shadow, isLight ? 0.16 : 0.22),
    ["--player-ink" as string]: rgba(ink, isLight ? 0.88 : 0.88),
    ["--player-muted" as string]: rgba(ink, isLight ? 0.7 : 0.74),
    ["--player-faint" as string]: rgba(ink, isLight ? 0.46 : 0.36),
    ["--player-line" as string]: rgba(ink, isLight ? 0.18 : 0.12),
    ["--player-line-strong" as string]: rgba(ink, isLight ? 0.32 : 0.28),
    ["--player-control-bg" as string]: rgba(shadow, isLight ? 0.11 : 0.3),
    ["--player-play-bg" as string]: rgba(ink, isLight ? 0.84 : 0.86),
    ["--player-play-text" as string]: rgba(inverse, isLight ? 0.94 : 0.94),
    ["--player-glow" as string]: rgba(ink, isLight ? 0.12 : 0.16),
  };
}

export default function Page() {
  const stageRef = useRef<HTMLElement>(null);
  const motionRef = useRef({
    beat: 0,
    beatTarget: 0,
    air: 0,
    airTarget: 0,
  });
  const playbackRef = useRef({
    params: HOME_VIBE.params,
  });
  const [active, setActive] = useState<Vibe | null>(null);
  const [preview, setPreview] = useState<Vibe>(HOME_VIBE);
  const [params, setParams] = useState<VibeParams>(HOME_VIBE.params);
  const [playing, setPlaying] = useState(false);
  const [fft, setFft] = useState<number[]>([]);
  const [savedVibes, setSavedVibes] = useState<Vibe[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatBaseVibe, setChatBaseVibe] = useState<Vibe | null>(null);

  const shelfVibes = useMemo(() => mergeShelfVibes(savedVibes), [savedVibes]);

  const preparePlayableVibe = useCallback((vibe: Vibe, prompt = "") => {
    return enforceMusicQuality(prompt || vibe.tagline || vibe.name, vibe).vibe;
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setSavedVibes(loadSavedVibes());
    });
  }, []);

  const selectVibe = useCallback((vibe: Vibe, prompt = "", autoplay = true) => {
    const playable = preparePlayableVibe(vibe, prompt);
    setActive(playable);
    setParams(playable.params);
    setPlaying(autoplay);
    setNotice(null);
    setChatBaseVibe(playable);
  }, [preparePlayableVibe]);

  useEffect(() => {
    const shared = decodeVibeFromHash(window.location.hash);
    if (shared) {
      queueMicrotask(() => {
        selectVibe(shared, "", false);
        setNotice("已打开分享来的氛围，可回到首页继续用对话修改。");
      });
    }
  }, [selectVibe]);

  function openVibeFromHome(vibe: Vibe) {
    const playable = preparePlayableVibe(vibe);
    selectVibe(playable, "", false);
  }

  function back() {
    setActive(null);
    setPlaying(false);
    setFft([]);
  }

  function togglePlaying() {
    if (playing) setFft([]);
    setPlaying((current) => !current);
  }

  const removeSavedVibe = useCallback((vibe: Vibe) => {
    const updated = removeSavedVibeFromLibrary(vibe.id);
    setSavedVibes(updated);
    setPreview((current) => (current.id === vibe.id ? HOME_VIBE : current));
    setChatBaseVibe((current) => (current?.id === vibe.id ? null : current));
    setNotice(`已移除「${vibe.name}」。`);
  }, []);

  const displayVibe = active ?? preview;
  const contrastVars = useMemo(() => readableThemeVars(displayVibe.palette.base), [displayVibe.palette.base]);

  useEffect(() => {
    playbackRef.current = {
      params,
    };

    if (!active || !playing) {
      const sourceParams = active ? params : preview.params;
      motionRef.current.beatTarget = clamp01(sourceParams.energy * 0.16);
      motionRef.current.airTarget = clamp01(sourceParams.ambience * 0.2 + sourceParams.space * 0.08);
    }
  }, [active, params, playing, preview.params]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setBeat = gsap.quickSetter(stage, "--beat");
    const setBeatSoft = gsap.quickSetter(stage, "--beat-soft");
    const setAir = gsap.quickSetter(stage, "--air");
    let raf = 0;

    function tick() {
      motionRef.current.beat += (motionRef.current.beatTarget - motionRef.current.beat) * 0.16;
      motionRef.current.air += (motionRef.current.airTarget - motionRef.current.air) * 0.12;
      setBeat(motionRef.current.beat.toFixed(3));
      setBeatSoft((motionRef.current.beat * 0.62).toFixed(3));
      setAir(motionRef.current.air.toFixed(3));
      raf = requestAnimationFrame(tick);
    }

    if (!reduceMotion) {
      gsap.fromTo(
        stage.querySelector(".content"),
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.48, ease: "power3.out" },
      );
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!active || !playing) {
      return;
    }

    let raf = 0;
    let lastCommit = 0;
    const frameInterval = 1000 / 15;
    const engine = getVibeAudioEngine();

    const tick = (now: number) => {
      const nextFft = engine.getFft();
      const lowEnergy = averageBand(nextFft, 0, 24);
      const highEnergy = averageBand(nextFft, 24, 84);
      const { params: currentParams } = playbackRef.current;

      motionRef.current.beatTarget = clamp01(lowEnergy * 1.85 + currentParams.energy * 0.14);
      motionRef.current.airTarget = clamp01(highEnergy * 1.1 + currentParams.ambience * 0.28);

      if (now - lastCommit >= frameInterval) {
        setFft(nextFft);
        lastCommit = now;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing]);

  return (
    <main
      ref={stageRef}
      className={`stage ${active ? "stage--detail" : "stage--home"} ${
        displayVibe.artwork?.imageUrl ? "stage--has-artwork" : ""
      }`}
      style={{
        ...contrastVars,
        ["--accent" as string]: displayVibe.palette.accent,
        ["--accent-2" as string]: displayVibe.palette.accent2,
        ["--base" as string]: displayVibe.palette.base,
        ["--beat" as string]: 0,
        ["--beat-soft" as string]: 0,
        ["--air" as string]: 0,
        background: displayVibe.palette.base,
      }}
    >
      <VibeBackground
        vibe={displayVibe}
        params={active ? params : preview.params}
        playing={active ? playing : false}
        fft={fft}
      />
      <div className="stage__vignette" />
      <div className="stage__grain" />

      <div className="content">
        {active ? (
          <PlayerView
            vibe={active}
            params={params}
            playing={playing}
            onBack={back}
            onTogglePlay={togglePlaying}
          />
        ) : (
          <Home
            shelfVibes={shelfVibes}
            notice={notice}
            chatBaseVibe={chatBaseVibe}
            onPreview={setPreview}
            onSelect={(vibe) => {
              openVibeFromHome(vibe);
            }}
            onGenerated={(vibe, _prompt, phase = "music") => {
              const updated = saveVibeToLibrary(vibe);
              setSavedVibes(updated);
              setChatBaseVibe(vibe);
              setPreview(vibe);
              setNotice(phase === "artwork" ? "视觉页面已更新，已加入本地唱片架。" : "已刻录完成，并加入本地唱片架。");
            }}
            onRemove={removeSavedVibe}
          />
        )}
      </div>
      {notice && active && <div className="toast">{notice}</div>}
    </main>
  );
}

function Home({
  shelfVibes,
  notice,
  chatBaseVibe,
  onPreview,
  onSelect,
  onGenerated,
  onRemove,
}: {
  shelfVibes: Vibe[];
  notice: string | null;
  chatBaseVibe: Vibe | null;
  onPreview: (v: Vibe) => void;
  onSelect: (v: Vibe) => void;
  onGenerated: (v: Vibe, prompt: string, phase?: "music" | "artwork") => void;
  onRemove: (v: Vibe) => void;
}) {
  const [selectedId, setSelectedId] = useState(() => chatBaseVibe?.id ?? shelfVibes[0]?.id ?? HOME_VIBE.id);
  const [atelierOpen, setAtelierOpen] = useState(false);
  const [atelierGenerating, setAtelierGenerating] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "edit">("edit");
  const [hoverDirection, setHoverDirection] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<UserAiConfig>(DEFAULT_USER_AI_CONFIG);
  const selectedIndex = Math.max(
    0,
    shelfVibes.findIndex((vibe) => vibe.id === selectedId),
  );
  const selectedVibe = shelfVibes[selectedIndex] ?? shelfVibes[0] ?? HOME_VIBE;
  const builtinIds = useMemo(() => new Set(VIBES.map((vibe) => vibe.id)), []);

  const canRemoveVibe = useCallback((vibe: Vibe) => !builtinIds.has(vibe.id), [builtinIds]);

  useEffect(() => {
    onPreview(selectedVibe);
  }, [onPreview, selectedVibe]);

  useEffect(() => {
    queueMicrotask(() => setAiConfig(loadUserAiConfig()));
  }, []);

  function handleSaveAiConfig(nextConfig: UserAiConfig) {
    saveUserAiConfig(nextConfig);
    setAiConfig(nextConfig);
    setConfigOpen(false);
  }

  const recordItems = useMemo(
    () =>
      shelfVibes
        .map((vibe, index) => ({
          vibe,
          index,
          offset: getCircularOffset(index, selectedIndex, shelfVibes.length),
        }))
        .filter(({ offset }) => shelfVibes.length <= 7 || Math.abs(offset) <= 3),
    [selectedIndex, shelfVibes],
  );

  const moveRecord = useCallback(
    (step: number) => {
      const next = shelfVibes[wrapIndex(selectedIndex + step, shelfVibes.length)];
      if (next) setSelectedId(next.id);
    },
    [selectedIndex, shelfVibes],
  );

  useEffect(() => {
    if (!hoverDirection || shelfVibes.length < 2) return;

    const timer = window.setInterval(() => {
      moveRecord(hoverDirection);
    }, 760);

    return () => window.clearInterval(timer);
  }, [hoverDirection, moveRecord, shelfVibes.length]);

  function updateHoverDirection(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const nextDirection = ratio < 0.34 ? -1 : ratio > 0.66 ? 1 : 0;
    setHoverDirection(nextDirection);
  }

  const homeStyle = {
    ["--gallery-base" as string]: selectedVibe.palette.base,
    ["--gallery-accent" as string]: selectedVibe.palette.accent,
    ["--gallery-accent-2" as string]: selectedVibe.palette.accent2,
  } as CSSProperties;

  return (
    <div className={`home home--gallery ${atelierOpen ? "home--atelier-open" : ""}`} style={homeStyle}>
      <div className="home__top">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          VibeLive
        </div>
        <div className="home__tools">
          <span className="home__tag">
            {hasUsableImageToolConfig(aiConfig)
              ? "image tool ready"
              : hasUsableUserAiConfig(aiConfig)
                ? "local key ready"
                : "private archive"}
          </span>
          <button type="button" className="home__config-button" onClick={() => setConfigOpen((open) => !open)}>
            AI 配置
          </button>
        </div>
      </div>

      <section className="home-gallery" aria-label="唱片画廊">
        <div className="home-gallery__copy">
          <span className="home-gallery__index mono">
            {String(selectedIndex + 1).padStart(2, "0")} / {String(shelfVibes.length).padStart(2, "0")}
          </span>
          <h1 className="home-gallery__title">「{selectedVibe.name}」</h1>
          <p className="home-gallery__subtitle">{selectedVibe.subtitle}</p>
          <p className="home-gallery__seal">- {Math.round(selectedVibe.params.tempo)} BPM -</p>
        </div>

        <p className="home-gallery__tagline">{selectedVibe.tagline}</p>
        {notice && <p className="home-gallery__notice">{notice}</p>}

        <div
          className="record-switcher"
          role="group"
          aria-label="切换唱片"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") moveRecord(-1);
            if (event.key === "ArrowRight") moveRecord(1);
          }}
        >
          <button type="button" className="record-switcher__nav" aria-label="上一张唱片" onClick={() => moveRecord(-1)}>
            ‹
          </button>

          <div
            className={`record-switcher__stage ${
              hoverDirection < 0 ? "is-hover-left" : hoverDirection > 0 ? "is-hover-right" : ""
            }`}
            onMouseMove={updateHoverDirection}
            onMouseLeave={() => setHoverDirection(0)}
          >
            <span className="record-switcher__hover-zone record-switcher__hover-zone--left" aria-hidden="true">
              滑向上一张
            </span>
            <span className="record-switcher__hover-zone record-switcher__hover-zone--right" aria-hidden="true">
              滑向下一张
            </span>
            {recordItems.map(({ vibe, offset }) => {
              const absOffset = Math.abs(offset);
              const recordStyle = {
                ["--record-x" as string]: `${offset * 132}px`,
                ["--record-mobile-x" as string]: `${offset * 76}px`,
                ["--record-y" as string]: `${absOffset * 4}px`,
                ["--record-scale" as string]: Math.max(0.58, 1 - absOffset * 0.12).toFixed(3),
                ["--record-rotate" as string]: `${offset * -7}deg`,
                ["--record-opacity" as string]: Math.max(0.2, 1 - absOffset * 0.2).toFixed(3),
                ["--record-z" as string]: `${24 - absOffset}`,
                ["--record-accent" as string]: vibe.palette.accent,
                ["--record-accent-2" as string]: vibe.palette.accent2,
                ["--record-base" as string]: vibe.palette.base,
              } as CSSProperties;
              const isActive = offset === 0;
              const canRemove = canRemoveVibe(vibe);

              return (
                <div
                  key={vibe.id}
                  className={`record-slide-frame ${isActive ? "is-active" : ""} ${canRemove ? "is-removable" : ""}`}
                  style={recordStyle}
                >
                  <button
                    type="button"
                    className={`record-slide ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`进入 ${vibe.name}`}
                    onMouseEnter={() => onPreview(vibe)}
                    onFocus={() => onPreview(vibe)}
                    onClick={() => {
                      setSelectedId(vibe.id);
                      setComposeMode("edit");
                      onSelect(vibe);
                    }}
                  >
                    <span className="record-slide__disc" aria-hidden="true" />
                    {vibe.artwork?.imageUrl && (
                      <span
                        className="record-slide__artwork"
                        style={{ backgroundImage: cssImageUrl(vibe.artwork.imageUrl) }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="record-slide__label">
                      <strong>{vibe.name}</strong>
                      <small>{vibe.subtitle}</small>
                      <em>点击进入</em>
                    </span>
                  </button>
                  {canRemove && (
                    <button
                      type="button"
                      className="record-slide__remove"
                      style={
                        isActive
                          ? ({
                              opacity: 1,
                              pointerEvents: "auto",
                              transform: "translateX(-50%) translateY(0)",
                            } as CSSProperties)
                          : undefined
                      }
                      aria-label={`移除 ${vibe.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(vibe);
                      }}
                    >
                      移除
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" className="record-switcher__nav" aria-label="下一张唱片" onClick={() => moveRecord(1)}>
            ›
          </button>
        </div>

        <div className="home-gallery__actions">
          <button type="button" className="home-gallery__primary" onClick={() => onSelect(selectedVibe)}>
            进入播放器
          </button>
          <button type="button" className="home-gallery__secondary" onClick={() => setAtelierOpen((open) => !open)}>
            {atelierOpen ? "收起手札" : atelierGenerating ? "刻录中" : "制作唱片"}
          </button>
        </div>
      </section>

      {atelierOpen && (
        <button
          type="button"
          className="home-atelier__scrim"
          aria-label="关闭制作窗口"
          onClick={() => setAtelierOpen(false)}
        />
      )}
      <section className={`home-atelier ${atelierOpen ? "is-open" : "is-closed"}`} aria-label="制作唱片" aria-hidden={!atelierOpen}>
        <div className="home-atelier__bar">
          <div className="home-atelier__bar-main">
            <span>制作唱片</span>
            <div className="home-atelier__mode" role="group" aria-label="制作模式">
              <button
                type="button"
                className={composeMode === "new" ? "is-active" : ""}
                aria-pressed={composeMode === "new"}
                onClick={() => setComposeMode("new")}
              >
                新建
              </button>
              <button
                type="button"
                className={composeMode === "edit" ? "is-active" : ""}
                aria-pressed={composeMode === "edit"}
                onClick={() => setComposeMode("edit")}
              >
                修改当前
              </button>
            </div>
          </div>
          <button type="button" onClick={() => setAtelierOpen(false)}>
            收起
          </button>
        </div>
        <VibePrompt
          baseVibe={composeMode === "edit" ? selectedVibe : null}
          accent={selectedVibe.palette.accent}
          accent2={selectedVibe.palette.accent2}
          onGenerated={(vibe, prompt, phase) => {
            setSelectedId(vibe.id);
            setComposeMode("edit");
            onGenerated(vibe, prompt, phase);
          }}
          onOpenVibe={onSelect}
          aiConfig={aiConfig}
          onGeneratingChange={setAtelierGenerating}
          onNewSession={() => setComposeMode("new")}
        />
      </section>

      {configOpen && (
        <>
          <button
            type="button"
            className="ai-config-panel__scrim"
            aria-label="关闭 AI 配置"
            onClick={() => setConfigOpen(false)}
          />
          <AiConfigPanel config={aiConfig} onClose={() => setConfigOpen(false)} onSave={handleSaveAiConfig} />
        </>
      )}

      <div className="home__foot" aria-hidden="true" />
    </div>
  );
}

function AiConfigPanel({
  config,
  onClose,
  onSave,
}: {
  config: UserAiConfig;
  onClose: () => void;
  onSave: (config: UserAiConfig) => void;
}) {
  const [draft, setDraft] = useState<UserAiConfig>(config);
  const agentReady = hasUsableUserAiConfig(draft);
  const imageToolReady = hasUsableImageToolConfig(draft);

  function updateImageTool(patch: Partial<UserAiConfig["imageTool"]>) {
    setDraft((current) => ({
      ...current,
      imageTool: {
        ...current.imageTool,
        ...patch,
      },
    }));
  }

  return (
    <section className="ai-config-panel" aria-label="AI 配置">
      <div className="ai-config-panel__bar">
        <div>
          <span className="mono">LOCAL CLIENT</span>
          <h2>AI 配置</h2>
        </div>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="ai-config-section">
        <div className="ai-config-section__head">
          <span>编曲 agent</span>
          <strong>{agentReady ? "ready" : "local"}</strong>
        </div>

        <label className="ai-config-field">
          <span>OPENAI_API_KEY</span>
          <input
            type="password"
            value={draft.apiKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="sk-..."
          />
        </label>

        <label className="ai-config-field">
          <span>OPENAI_BASE_URL</span>
          <input
            value={draft.baseURL}
            spellCheck={false}
            onChange={(event) => setDraft((current) => ({ ...current, baseURL: event.target.value }))}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label className="ai-config-field">
          <span>OPENAI_MODEL</span>
          <input
            value={draft.model}
            spellCheck={false}
            onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
            placeholder="gpt-4.1-mini"
          />
        </label>
      </div>

      <div className="ai-config-section">
        <div className="ai-config-section__head">
          <span>背景图 tool</span>
          <strong>{imageToolReady ? "ready" : draft.imageTool.enabled ? "on" : "off"}</strong>
        </div>

        <button
          type="button"
          className={`ai-config-toggle ${draft.imageTool.enabled ? "is-active" : ""}`}
          aria-pressed={draft.imageTool.enabled}
          onClick={() => updateImageTool({ enabled: !draft.imageTool.enabled })}
        >
          <span aria-hidden="true" />
          {draft.imageTool.enabled ? "已开启图片生成" : "开启图片生成"}
        </button>

        <label className="ai-config-field">
          <span>TOOL_OPENAI_API_KEY</span>
          <input
            type="password"
            value={draft.imageTool.apiKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => updateImageTool({ apiKey: event.target.value })}
            placeholder="sk-..."
          />
        </label>

        <label className="ai-config-field">
          <span>TOOL_OPENAI_BASE_URL</span>
          <input
            value={draft.imageTool.baseURL}
            spellCheck={false}
            onChange={(event) => updateImageTool({ baseURL: event.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label className="ai-config-field">
          <span>TOOL_OPENAI_MODEL</span>
          <input
            value={draft.imageTool.model}
            spellCheck={false}
            onChange={(event) => updateImageTool({ model: event.target.value })}
            placeholder="gpt-image-1"
          />
        </label>
      </div>

      <div className="ai-config-panel__actions">
        <button type="button" onClick={() => onSave(DEFAULT_USER_AI_CONFIG)}>
          清除
        </button>
        <button type="button" onClick={() => onSave(draft)}>
          保存
        </button>
      </div>
    </section>
  );
}

function wrapIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

function getCircularOffset(index: number, selectedIndex: number, total: number) {
  if (total <= 0) return 0;
  let offset = index - selectedIndex;
  const half = total / 2;
  if (offset > half) offset -= total;
  if (offset < -half) offset += total;
  return offset;
}

function mergeShelfVibes(savedVibes: Vibe[]) {
  const builtinIds = new Set(VIBES.map((vibe) => vibe.id));
  const uniqueSaved = savedVibes.filter((vibe, index, list) => {
    if (builtinIds.has(vibe.id)) return false;
    return list.findIndex((item) => item.id === vibe.id) === index;
  });
  return [...VIBES, ...[...uniqueSaved].reverse()];
}
