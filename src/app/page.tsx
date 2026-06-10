"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getVibeAudioEngine } from "@/audio/engine";
import { decodeVibeFromHash, encodeVibeForHash, loadSavedVibes, saveVibeToLibrary } from "@/data/persistence";
import type { MusicFeedbackOption, RegenerateTarget } from "@/data/regeneration";
import { VIBES, type Vibe, type VibeParams } from "@/data/vibes";
import VibeBackground from "@/components/VibeBackground";
import VibeCanvasFrame from "@/components/VibeCanvasFrame";
import PlayerView from "@/components/PlayerView";
import VinylSceneSelector from "@/components/VinylSceneSelector";
import { enforceMusicQuality } from "@/music/quality";

// 首页用一个"中性"的氛围给背景画布打底
const HOME_VIBE = VIBES[VIBES.length - 1]; // cosmic-drift

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function Page() {
  const stageRef = useRef<HTMLElement>(null);
  const motionRef = useRef({
    beat: 0,
    beatTarget: 0,
    air: 0,
    airTarget: 0,
  });
  const [active, setActive] = useState<Vibe | null>(null);
  const [preview, setPreview] = useState<Vibe>(HOME_VIBE);
  const [params, setParams] = useState<VibeParams>(HOME_VIBE.params);
  const [playing, setPlaying] = useState(false);
  const [fft, setFft] = useState<number[]>([]);
  const [savedVibes, setSavedVibes] = useState<Vibe[]>([]);
  const [lastPrompt, setLastPrompt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

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
    setLastPrompt(prompt);
    setPlaying(autoplay);
    setNotice(null);
    setShareUrl(null);
  }, [preparePlayableVibe]);

  useEffect(() => {
    const shared = decodeVibeFromHash(window.location.hash);
    if (shared) {
      queueMicrotask(() => {
        selectVibe(shared, "", false);
        setNotice("已打开分享来的氛围，点保存可加入自己的唱片架。");
        setShareUrl(window.location.href);
      });
    }
  }, [selectVibe]);

  useEffect(() => {
    if (!active || !playing) {
      return;
    }

    let raf = 0;
    const engine = getVibeAudioEngine();
    const tick = () => {
      setFft(engine.getFft());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing]);

  async function playVibeFromHome(vibe: Vibe) {
    const playable = preparePlayableVibe(vibe);
    selectVibe(playable, "", true);
    try {
      const engine = getVibeAudioEngine();
      engine.load(playable, playable.params);
      await engine.start();
    } catch (error) {
      setPlaying(false);
      setNotice(error instanceof Error ? error.message : "浏览器拦截了自动播放，进入后再点一次播放。");
    }
  }

  function back() {
    setActive(null);
    setPlaying(false);
  }

  function changeParam(key: keyof VibeParams, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function regenerateActive(target: RegenerateTarget = "music", feedback?: MusicFeedbackOption) {
    if (!active) return;
    const regeneratePrompt = lastPrompt || active.tagline || active.name;

    if (!regeneratePrompt) {
      setActive(null);
      setPlaying(false);
      setNotice("回到首页后输入一句新的描述再生成。");
      return;
    }

    const targetLabel: Record<RegenerateTarget, string> = {
      music: "音乐",
      drums: "鼓",
      bass: "低音",
      pad: "铺底",
      melody: "旋律",
      arp: "琶音",
      visual: "视觉",
      full: "整首氛围",
    };

    const qualityHints =
      active.musicQuality?.issues
        .slice(0, 4)
        .map((issue) => issue.message)
        .join("；") || "";
    const promptWithFeedback = [
      regeneratePrompt,
      feedback?.prompt,
      qualityHints ? `当前质量报告提示：${qualityHints}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setNotice(feedback ? `正在按「${feedback.label}」修复这张唱片...` : `正在重新创作这张唱片的${targetLabel[target]}...`);
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptWithFeedback,
        baseVibe: { ...active, params },
        regenerateTarget: target,
      }),
    });
    const data = (await response.json()) as { vibe?: Vibe; error?: string };
    if (!response.ok || !data.vibe) {
      setNotice(data.error || "再生成失败，请稍后再试。");
      return;
    }
    const updated = saveVibeToLibrary(data.vibe);
    setSavedVibes(updated);
    selectVibe(data.vibe, regeneratePrompt, false);
    setNotice(feedback ? `已按「${feedback.label}」重新刻录，并加入本地唱片架。` : `已重新刻录${targetLabel[target]}，并加入本地唱片架。`);
  }

  function saveActive() {
    if (!active) return;
    const updated = saveVibeToLibrary({ ...active, params });
    setSavedVibes(updated);
    setNotice("已加入本地唱片架。");
  }

  async function shareActive() {
    if (!active) return;
    const hash = `vibe=${encodeURIComponent(encodeVibeForHash({ ...active, params }))}`;
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    setShareUrl(url);
    try {
      await navigator.clipboard?.writeText(url);
      setNotice("分享链接已复制。别人打开后可播放，也可保存到自己的唱片架。");
    } catch {
      setNotice("分享链接已生成，当前浏览器未允许自动复制，可在下方手动复制。");
    }
  }

  const displayVibe = active ?? preview;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setBeat = gsap.quickSetter(stage, "--beat");
    const setBeatSoft = gsap.quickSetter(stage, "--beat-soft");
    const setAir = gsap.quickSetter(stage, "--air");
    let raf = 0;
    let pressedButton: HTMLButtonElement | null = null;

    function tick() {
      motionRef.current.beat += (motionRef.current.beatTarget - motionRef.current.beat) * 0.16;
      motionRef.current.air += (motionRef.current.airTarget - motionRef.current.air) * 0.12;
      setBeat(motionRef.current.beat.toFixed(3));
      setBeatSoft((motionRef.current.beat * 0.62).toFixed(3));
      setAir(motionRef.current.air.toFixed(3));
      raf = requestAnimationFrame(tick);
    }

    function releaseButton(button: HTMLButtonElement | null) {
      if (!button || reduceMotion) return;
      gsap.to(button, {
        scale: 1,
        y: 0,
        duration: 0.32,
        ease: "elastic.out(1, 0.58)",
        overwrite: true,
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || reduceMotion) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      pressedButton = button;
      gsap.to(button, {
        scale: 0.965,
        y: 1,
        duration: 0.12,
        ease: "power2.out",
        overwrite: true,
      });
    }

    function handlePointerUp() {
      releaseButton(pressedButton);
      pressedButton = null;
    }

    if (!reduceMotion) {
      gsap.fromTo(
        stage.querySelector(".content"),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.82, ease: "power3.out" },
      );
      stage.addEventListener("pointerdown", handlePointerDown);
      stage.addEventListener("pointerup", handlePointerUp);
      stage.addEventListener("pointercancel", handlePointerUp);
      stage.addEventListener("pointerleave", handlePointerUp);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointerdown", handlePointerDown);
      stage.removeEventListener("pointerup", handlePointerUp);
      stage.removeEventListener("pointercancel", handlePointerUp);
      stage.removeEventListener("pointerleave", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const values = fft.length > 0 ? fft : [];
    const lowBand = values.slice(0, 24);
    const highBand = values.slice(24, 84);
    const lowEnergy =
      lowBand.length > 0
        ? lowBand.reduce((sum, value) => sum + value, 0) / lowBand.length / 255
        : 0;
    const highEnergy =
      highBand.length > 0
        ? highBand.reduce((sum, value) => sum + value, 0) / highBand.length / 255
        : 0;
    const sourceParams = active ? params : preview.params;

    motionRef.current.beatTarget = playing
      ? clamp01(lowEnergy * 1.85 + sourceParams.energy * 0.14)
      : clamp01(sourceParams.energy * 0.16);
    motionRef.current.airTarget = playing
      ? clamp01(highEnergy * 1.1 + sourceParams.ambience * 0.28)
      : clamp01(sourceParams.ambience * 0.2 + sourceParams.space * 0.08);
  }, [active, fft, params, playing, preview.params]);

  return (
    <main
      ref={stageRef}
      className="stage"
      style={{
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
      {active?.visualCode && <VibeCanvasFrame vibe={active} params={params} playing={playing} fft={fft} />}
      <div className="stage__vignette" />
      <div className="stage__grain" />

      <div className="content">
        {active ? (
          <PlayerView
            vibe={active}
            params={params}
            playing={playing}
            fft={fft}
            onBack={back}
            onTogglePlay={() => setPlaying((p) => !p)}
            onParamChange={changeParam}
            onRegenerate={regenerateActive}
            onSave={saveActive}
            onShare={shareActive}
            shareUrl={shareUrl}
          />
        ) : (
          <Home
            shelfVibes={shelfVibes}
            savedVibes={savedVibes}
            notice={notice}
            onPreview={setPreview}
            onSelect={(vibe) => {
              void playVibeFromHome(vibe);
            }}
            onGenerated={(vibe, prompt) => {
              const updated = saveVibeToLibrary(vibe);
              setSavedVibes(updated);
              selectVibe(vibe, prompt, false);
              setNotice("已刻录完成，并加入本地唱片架。");
            }}
          />
        )}
      </div>
      {notice && active && <div className="toast">{notice}</div>}
    </main>
  );
}

function Home({
  shelfVibes,
  savedVibes,
  notice,
  onPreview,
  onSelect,
  onGenerated,
}: {
  shelfVibes: Vibe[];
  savedVibes: Vibe[];
  notice: string | null;
  onPreview: (v: Vibe) => void;
  onSelect: (v: Vibe) => void;
  onGenerated: (v: Vibe, prompt: string) => void;
}) {
  return (
    <div className="home">
      <div className="home__top">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          VibeLive
        </div>
        <span className="home__tag">Open-source audio lab</span>
      </div>

      <div className="home__main">
        <section className="home__hero" aria-labelledby="home-title">
          <h1 id="home-title" className="home__title">
            将此刻
            <br />
            想象刻录
          </h1>
          <p className="home__sub">把一句场景刻进可循环播放的氛围唱片。</p>
          <div className="home__score" aria-hidden="true">
            {["TONE", "LOOP", "LIGHT"].map((label, scoreIndex) => (
              <span key={label} style={{ ["--score-level" as string]: 0.38 + scoreIndex * 0.18 }}>
                <b className="mono">{label}</b>
              </span>
            ))}
          </div>
          {notice && <p className="home__notice">{notice}</p>}
        </section>

        <VinylSceneSelector
          vibes={shelfVibes}
          onPreview={onPreview}
          onSelect={onSelect}
          onGenerated={onGenerated}
        />
      </div>

      {savedVibes.length > 0 && (
        <section className="saved-vibes" aria-label="本地保存的唱片架">
          <div>
            <h2>我的唱片架</h2>
            <p>刻录和保存的氛围唱片会留在当前浏览器。</p>
          </div>
          <div className="saved-vibes__grid">
            {savedVibes.map((vibe) => (
              <button
                key={vibe.id}
                type="button"
                style={{ ["--saved-accent" as string]: vibe.palette.accent }}
                onClick={() => onSelect(vibe)}
              >
                <span aria-hidden="true">{vibe.glyph}</span>
                <strong>{vibe.name}</strong>
                <small className="mono">{vibe.subtitle}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="home__foot">
        <span>Web Audio and generative patterns</span>
        <span>MIT open source, deploy with your own environment</span>
      </div>
    </div>
  );
}

function mergeShelfVibes(savedVibes: Vibe[]) {
  const builtinIds = new Set(VIBES.map((vibe) => vibe.id));
  const uniqueSaved = savedVibes.filter((vibe, index, list) => {
    if (builtinIds.has(vibe.id)) return false;
    return list.findIndex((item) => item.id === vibe.id) === index;
  });
  return [...VIBES, ...[...uniqueSaved].reverse()];
}
