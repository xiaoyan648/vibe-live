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
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(".player__top", { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.52 })
        .fromTo(
          ".player__halo, .player__name, .player__tagline, .player__status, .player__signal, .player__readout, .player__quality",
          { y: 18, autoAlpha: 0, scale: 0.98 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.72, stagger: 0.045 },
          "-=0.28",
        )
        .fromTo(".dock .panel", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.62, stagger: 0.06 }, "-=0.36");
    }, root);

    return () => ctx.revert();
  }, [vibe.id]);

  useEffect(() => {
    const root = rootRef.current;
    const halo = root?.querySelector(".player__halo");
    const play = root?.querySelector(".play");
    if (!halo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.killTweensOf([halo, play]);
    if (playing) {
      gsap.to(halo, {
        scale: 1.035,
        duration: 0.72,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      if (play) {
        gsap.to(play, {
          boxShadow: "0 0 58px color-mix(in srgb, var(--accent) 82%, transparent)",
          duration: 0.58,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
      return () => gsap.killTweensOf([halo, play]);
    }

    gsap.to(halo, { scale: 1, duration: 0.42, ease: "power2.out" });
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
        <div className="codepeek">
          <button className="codepeek__btn" onClick={() => setShowCode((s) => !s)}>
            {"</>"} {showCode ? "隐藏代码" : "查看代码"}
          </button>
          {showCode && (
            <div className="codepeek__panel">
              <p className="codepeek__title">Pattern · 实时</p>
              <pre className="mono">{patternCode}</pre>
            </div>
          )}
        </div>
      </header>

      <section className="player__center">
        <div className="player__halo" aria-hidden="true">
          <span className="player__halo-ring player__halo-ring--outer" />
          <span className="player__halo-ring player__halo-ring--inner" />
          <span className="player__glyph">{vibe.glyph}</span>
        </div>
        <h1 className="player__name">
          <span>{vibe.name}</span>
        </h1>
        <p className="player__tagline">{vibe.tagline}</p>
        <span className="player__status">
          <span className={`dot ${playing ? "dot--live" : ""}`} />
          {playing ? "正在生成无限循环音乐" : "已暂停"}
        </span>
        <div className="player__signal" aria-hidden="true">
          {signalSteps.map((step, stepIndex) => (
            <span
              key={`${vibe.id}-signal-${stepIndex}`}
              className={step.active ? "is-on" : ""}
              style={{ ["--step-level" as string]: step.level }}
            />
          ))}
        </div>
        <div className="player__readout mono" aria-label="当前音乐读数">
          <span>{Math.round(params.tempo)} BPM</span>
          <span>{pattern ? `${pattern.root} ${pattern.scale}` : "LIVE LOOP"}</span>
          <span>DENS {Math.round(params.density * 100)}</span>
          <span>SPACE {Math.round(params.space * 100)}</span>
        </div>
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
        {audioError && <span className="player__audio-error">{audioError}</span>}
      </section>

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
            <span className="transport__label">Tempo</span>
            <span className="transport__value mono">
              {Math.round(params.tempo)} <small>BPM</small>
            </span>
          </div>
        </div>

        <div className={`panel panel--params midi-panel ${controlsOpen ? "midi-panel--open" : "midi-panel--collapsed"}`}>
          <div className="midi-panel__header">
            <div>
              <span className="midi-panel__eyebrow mono">MIDI CONTROL</span>
              <h2>声音控制盘</h2>
            </div>
            <div className="midi-panel__right">
              <div className="midi-panel__screen mono" aria-label="当前音乐设定">
                <span>{Math.round(params.tempo)} BPM</span>
                <span>{pattern ? `${pattern.root} ${pattern.scale}` : "LIVE LOOP"}</span>
              </div>
              <button
                type="button"
                className="midi-panel__toggle"
                aria-expanded={controlsOpen}
                onClick={() => setControlsOpen((open) => !open)}
              >
                {controlsOpen ? "收起" : "控制盘"}
              </button>
            </div>
          </div>

          <div className="midi-panel__controls" aria-hidden={!controlsOpen}>
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
        </div>

        <div className="panel panel--actions">
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
              <span className="regen-control__target mono">TARGET / {regenerateLabel}</span>
              <button type="button" className="regen-control__submit" onClick={() => onRegenerate(regenerateTarget)}>
                再生成
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
