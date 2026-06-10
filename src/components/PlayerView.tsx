"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getVibeAudioEngine } from "@/audio/engine";
import { buildStrudelCode } from "@/audio/strudelCode";
import {
  MUSIC_FEEDBACK_OPTIONS,
  PLAYER_REGENERATE_OPTIONS,
  type MusicFeedbackOption,
  type RegenerateTarget,
} from "@/data/regeneration";
import type { Vibe, VibeParams } from "@/data/vibes";
import { PARAM_META } from "@/data/vibes";
import Slider from "./Slider";

interface Props {
  vibe: Vibe;
  params: VibeParams;
  playing: boolean;
  fft?: number[];
  onBack: () => void;
  onTogglePlay: () => void;
  onParamChange: (key: keyof VibeParams, value: number) => void;
  onRegenerate?: (target: RegenerateTarget, feedback?: MusicFeedbackOption) => void;
  onSave?: () => void;
  onShare?: () => void;
  shareUrl?: string | null;
}

const KEYBOARD_KEYS = [
  { note: "C", black: false },
  { note: "C#", black: true },
  { note: "D", black: false },
  { note: "D#", black: true },
  { note: "E", black: false },
  { note: "F", black: false },
  { note: "F#", black: true },
  { note: "G", black: false },
  { note: "G#", black: true },
  { note: "A", black: false },
  { note: "A#", black: true },
  { note: "B", black: false },
  { note: "C", black: false },
  { note: "C#", black: true },
  { note: "D", black: false },
  { note: "D#", black: true },
  { note: "E", black: false },
];

const PARAM_HINTS: Record<keyof VibeParams, string> = {
  energy: "影响鼓、低音和整体律动强度。",
  warmth: "提高模拟感与柔和度，降低冷硬数字感。",
  space: "控制混响空间和声场距离。",
  brightness: "调整高频亮度与前景清晰度。",
  ambience: "控制雨声、风声、城市底噪等环境层。",
  density: "影响音符、装饰音和层次繁复程度。",
  tempo: "控制循环速度。",
};

function patternToSteps(pattern?: string, fallback = "0---0---4---3---") {
  const source = (pattern || fallback).replace(/\s/g, "") || fallback;
  return Array.from({ length: 24 }, (_, step) => {
    const char = source[step % source.length] ?? "-";
    const active = !["-", ".", "_"].includes(char);
    const numeric = Number.parseInt(char, 16);
    const level = active ? (Number.isNaN(numeric) ? 0.74 : 0.32 + Math.min(numeric, 12) / 16) : 0.14;
    return { active, level };
  });
}

export default function PlayerView({
  vibe,
  params,
  playing,
  fft = [],
  onBack,
  onTogglePlay,
  onParamChange,
  onRegenerate,
  onSave,
  onShare,
  shareUrl,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<RegenerateTarget>("music");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [visualizerPhase, setVisualizerPhase] = useState(0);
  const patternCode = useMemo(() => {
    return buildStrudelCode(vibe, params);
  }, [params, vibe]);

  const pattern = vibe.pattern;
  const seedOffset = Math.abs(pattern?.seed ?? vibe.id.length) % 7;
  const activeKeyCount = Math.max(2, Math.round(params.density * 8 + params.energy * 4));
  const signalSteps = useMemo(
    () =>
      patternToSteps(
        pattern?.mini?.bassline ??
          pattern?.mini?.melodyMotif ??
          pattern?.mini?.arpPattern ??
          pattern?.mini?.drums?.kick,
      ),
    [pattern],
  );
  const regenerateLabel =
    PLAYER_REGENERATE_OPTIONS.find((option) => option.target === regenerateTarget)?.label ?? "音乐";
  const musicQuality = vibe.musicQuality;
  const qualityTone =
    !musicQuality ? "unknown" : musicQuality.score >= 86 ? "good" : musicQuality.score >= 70 ? "warn" : "fail";
  const qualityIssues = musicQuality?.issues.slice(0, 3) ?? [];
  const visualizerBars = useMemo(() => {
    const clampLevel = gsap.utils.clamp(0.08, 1);
    const mapFft = gsap.utils.mapRange(0, 1, 0.14, 1);
    const fallback = signalSteps.length > 0 ? signalSteps : patternToSteps();
    const bandCount = 96;
    const waveMotion = playing ? 1 : 0.18;
    const seedPhase = ((pattern?.seed ?? vibe.id.length) % 360) * (Math.PI / 180);

    return Array.from({ length: bandCount }, (_, index) => {
      const bandProgress = index / Math.max(1, bandCount - 1);
      const fftIndex = Math.floor(Math.pow(bandProgress, 1.7) * Math.max(fft.length - 1, 0));
      const raw = fft.length > 0 ? fft[fftIndex] ?? 0 : undefined;
      const fallbackStep = fallback[index % fallback.length];
      const circle = bandProgress * Math.PI * 2;
      const longWave = (Math.sin(visualizerPhase + circle * 3 + seedPhase) + 1) / 2;
      const chop = (Math.sin(visualizerPhase * 1.76 - circle * 9) + 1) / 2;
      const swell = (Math.sin(visualizerPhase * 0.62 + circle * 1.4) + 1) / 2;
      const waveLevel = (longWave * 0.54 + chop * 0.28 + swell * 0.18) * waveMotion;
      const patternLevel = fallbackStep.level * (0.26 + waveLevel * 0.74);
      const audioLevel =
        raw === undefined ? patternLevel : Math.pow(mapFft(gsap.utils.clamp(0, 1, raw)), 0.72) * 0.72 + waveLevel * 0.28;
      const level = clampLevel(audioLevel);
      const sweep = Math.abs(index - bandCount / 2) / (bandCount / 2);
      const radius = 0.84 + (1 - sweep) * 0.16 + (waveLevel - 0.5) * 0.035;

      return {
        level,
        radius,
        angle: index * (360 / bandCount),
        delay: `${index * -0.018}s`,
      };
    });
  }, [fft, pattern?.seed, playing, signalSteps, vibe.id.length, visualizerPhase]);

  async function handleTogglePlay() {
    const engine = getVibeAudioEngine();

    if (playing) {
      engine.pause();
      onTogglePlay();
      return;
    }

    try {
      setAudioError(null);
      await engine.start();
      onTogglePlay();
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "浏览器音频启动失败，请再点一次播放。");
    }
  }

  useEffect(() => {
    const engine = getVibeAudioEngine();
    engine.load(vibe, params);
  }, [params, vibe]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastTime = performance.now();
    let accumulator = 0;
    const frameInterval = 1000 / 30;
    const tempoRate = gsap.utils.mapRange(54, 140, 0.78, 1.72)(params.tempo);

    const tick = () => {
      const now = performance.now();
      const delta = Math.min(80, now - lastTime);
      lastTime = now;
      accumulator += delta;
      if (accumulator < frameInterval) return;

      const step = accumulator / 1000;
      accumulator = 0;
      setVisualizerPhase((phase) => {
        if (!playing) return phase + step * 0.72;
        return (phase + step * Math.PI * 2 * tempoRate) % (Math.PI * 64);
      });
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [params.tempo, playing]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(".player__top", { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.52 })
        .fromTo(
          ".player__deck, .player__caption",
          { y: 20, autoAlpha: 0, scale: 0.98 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.76, stagger: 0.045 },
          "-=0.28",
        )
        .fromTo(
          ".audio-ring__bar",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.56, stagger: { amount: 0.34, from: "center" } },
          "-=0.46",
        )
        .fromTo(".dock .panel", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.62, stagger: 0.04 }, "-=0.36");
    }, root);

    return () => ctx.revert();
  }, [vibe.id]);

  useEffect(() => {
    const root = rootRef.current;
    const halo = root?.querySelector(".player__deck");
    const record = root?.querySelector(".player-record");
    const play = root?.querySelector(".play");
    if (!halo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.killTweensOf([halo, record, play]);
    if (playing) {
      gsap.to(halo, {
        scale: 1.012,
        duration: 0.82,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      if (record) {
        gsap.to(record, {
          rotation: "+=360",
          duration: 18,
          ease: "none",
          repeat: -1,
          transformOrigin: "50% 50%",
        });
      }
      if (play) {
        gsap.to(play, {
          boxShadow: "0 0 58px color-mix(in srgb, var(--accent) 82%, transparent)",
          duration: 0.58,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
      return () => gsap.killTweensOf([halo, record, play]);
    }

    gsap.to(halo, { scale: 1, duration: 0.42, ease: "power2.out" });
    if (record) gsap.to(record, { scale: 1, duration: 0.3, ease: "power2.out" });
    if (play) gsap.to(play, { scale: 1, duration: 0.3, ease: "power2.out" });
  }, [playing]);

  useEffect(() => {
    const engine = getVibeAudioEngine();
    if (!playing) {
      engine.pause();
      return;
    }

    engine.start().catch((error) => {
      setAudioError(error instanceof Error ? error.message : "浏览器音频启动失败，请再点一次播放。");
    });

    return () => {
      engine.pause();
    };
  }, [playing]);

  return (
    <div ref={rootRef} className={`player ${playing ? "player--playing" : ""}`}>
      <header className="player__top">
        <button className="back" onClick={onBack}>
          ← 返回氛围
        </button>
        <span className="player__id mono">{vibe.subtitle}</span>
      </header>

      <section className="player__center">
        <div className="player__deck" aria-hidden="true">
          <div className="audio-ring">
            {visualizerBars.map((bar, index) => (
              <span
                key={`${vibe.id}-ring-${index}`}
                className="audio-ring__bar"
                style={{
                  ["--bar-angle" as string]: `${bar.angle}deg`,
                  ["--bar-level" as string]: bar.level,
                  ["--bar-radius" as string]: bar.radius,
                  ["--bar-delay" as string]: bar.delay,
                }}
              />
            ))}
          </div>
          <span className="player__halo-ring player__halo-ring--outer" />
          <span className="player__halo-ring player__halo-ring--inner" />
          <div className="turntable-plinth">
            <div className="player-record">
              <span className="player-record__rim" />
              <span className="player-record__shine" />
              <span className="player-record__grooves" />
              <span className="player-record__label">
                <strong>{vibe.glyph}</strong>
                <small>{Math.round(params.tempo)} BPM</small>
              </span>
              <span className="player-record__pin" />
            </div>
            <div className="player-tonearm">
              <span className="player-tonearm__base" />
              <span className="player-tonearm__wand" />
              <span className="player-tonearm__head" />
            </div>
          </div>
        </div>
        <div className="player__caption">
          <h1 className="player__name">
            <span>{vibe.name}</span>
          </h1>
          <p className="player__tagline">{vibe.tagline}</p>
          <span className="player__status">
            <span className={`dot ${playing ? "dot--live" : ""}`} />
            {playing ? "正在生成无限循环音乐" : "已暂停"}
          </span>
          <div className="player__readout mono" aria-label="当前音乐读数">
            <span>{Math.round(params.tempo)} BPM</span>
            <span>{pattern ? `${pattern.root} ${pattern.scale}` : "LIVE LOOP"}</span>
            <span>DENS {Math.round(params.density * 100)}</span>
            <span>SPACE {Math.round(params.space * 100)}</span>
          </div>
        </div>
        {audioError && <span className="player__audio-error">{audioError}</span>}
      </section>

      {controlsOpen && (
        <section className="mixer-drawer" aria-label="展开的声音控制盘">
          <div className="mixer-drawer__head">
            <div>
              <span className="mixer-drawer__eyebrow mono">MIXER</span>
              <h2>调音台</h2>
            </div>
            <div className="mixer-drawer__actions">
              <button type="button" className="midi-panel__toggle" onClick={() => setShowCode((value) => !value)}>
                {showCode ? "隐藏代码" : "代码"}
              </button>
              <button type="button" className="midi-panel__toggle" onClick={() => setControlsOpen(false)}>
                收起
              </button>
            </div>
          </div>

          <div className="midi-panel__controls">
            {PARAM_META.map((meta) => (
              <Slider
                key={meta.key}
                label={meta.label}
                hint={PARAM_HINTS[meta.key]}
                value={params[meta.key]}
                min={meta.min}
                max={meta.max}
                unit={meta.unit}
                onChange={(v) => onParamChange(meta.key, v)}
              />
            ))}
          </div>

          <div className="mixer-drawer__lower">
            <div className="midi-panel__keyboard" aria-hidden="true">
              {KEYBOARD_KEYS.map((key, keyIndex) => {
                const active = (keyIndex + seedOffset) % 5 < activeKeyCount / 3;
                return (
                  <span
                    key={`${key.note}-${keyIndex}`}
                    className={`midi-key ${key.black ? "midi-key--black" : "midi-key--white"} ${
                      active ? "midi-key--active" : ""
                    }`}
                    style={{ ["--key-level" as string]: `${0.2 + ((keyIndex + seedOffset) % 5) * 0.16}` }}
                  >
                    {!key.black && key.note}
                  </span>
                );
              })}
            </div>

            {onRegenerate && (
              <div className="regen-control" aria-label="局部再生成目标">
                <div className="regen-control__options">
                  {PLAYER_REGENERATE_OPTIONS.map((option) => (
                    <button
                      key={option.target}
                      type="button"
                      className={option.target === regenerateTarget ? "is-active" : ""}
                      onClick={() => setRegenerateTarget(option.target)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="regen-control__submit" onClick={() => onRegenerate(regenerateTarget)}>
                  再生成{regenerateLabel}
                </button>
                <div className="regen-feedback" aria-label="音乐反馈再生成">
                  <span className="regen-feedback__label mono">FIX</span>
                  {MUSIC_FEEDBACK_OPTIONS.map((option) => (
                    <button key={option.key} type="button" onClick={() => onRegenerate(option.target, option)}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {musicQuality && (
              <div className={`player__quality player__quality--${qualityTone}`} aria-label="音乐质量报告">
                <div className="player__quality-score mono">
                  <span>QUALITY</span>
                  <strong>{Math.round(musicQuality.score)}</strong>
                  {musicQuality.repaired && <em>REPAIRED</em>}
                </div>
                {qualityIssues.length > 0 && (
                  <ul>
                    {qualityIssues.map((issue) => (
                      <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {showCode && (
              <div className="codepeek__panel codepeek__panel--inline">
                <p className="codepeek__title">Pattern / 实时</p>
                <pre className="mono">{patternCode}</pre>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="dock">
        <div className="panel panel--transport">
          <button
            className="play"
            onClick={handleTogglePlay}
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
              </svg>
            )}
          </button>
          <div className="transport__meta">
            <span className="transport__label">{playing ? "Playing" : "Paused"}</span>
            <span className="transport__value mono">
              {Math.round(params.tempo)} <small>BPM</small>
            </span>
          </div>
        </div>

        <div className="panel panel--now">
          <span className="panel--now__cover" aria-hidden="true">{vibe.glyph}</span>
          <div>
            <strong>{vibe.name}</strong>
            <span>{pattern ? `${pattern.root} ${pattern.scale}` : vibe.subtitle}</span>
          </div>
        </div>

        <div className="panel panel--quick">
          <div className="midi-panel__screen mono" aria-label="当前音乐设定">
            <span>{Math.round(params.tempo)} BPM</span>
            <span>{Math.round(params.energy * 100)} ENERGY</span>
            <span>{Math.round(params.space * 100)} SPACE</span>
          </div>
          <button
            type="button"
            className="midi-panel__toggle"
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((open) => !open)}
          >
            调音台
          </button>
        </div>

        <div className="panel panel--actions">
          {onRegenerate && (
            <button type="button" onClick={() => onRegenerate(regenerateTarget)}>
              重刻
            </button>
          )}
          {onSave && (
            <button type="button" onClick={onSave}>
              保存
            </button>
          )}
          {onShare && (
            <button type="button" onClick={onShare}>
              分享
            </button>
          )}
          {shareUrl && (
            <div className="share-link" aria-label="当前分享链接">
              <span className="share-link__label mono">SHARE LINK</span>
              <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={onShare}>
                复制
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
