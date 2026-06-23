"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getVibeAudioEngine } from "@/audio/engine";
import type { Vibe, VibeParams } from "@/data/vibes";

interface Props {
  vibe: Vibe;
  params: VibeParams;
  playing: boolean;
  onBack: () => void;
  onTogglePlay: () => void;
}

const VISUALIZER_BAR_COUNT = 44;

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getStableSeed(vibe: Vibe) {
  if (vibe.pattern?.seed) return vibe.pattern.seed;
  return Array.from(vibe.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export default function PlayerView({
  vibe,
  params,
  playing,
  onBack,
  onTogglePlay,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pattern = vibe.pattern;
  const visualizerBars = useMemo(() => {
    const seed = getStableSeed(vibe);
    const center = (VISUALIZER_BAR_COUNT - 1) / 2;
    return Array.from({ length: VISUALIZER_BAR_COUNT }, (_, index) => {
      const distanceFromCenter = Math.abs(index - center) / center;
      const centerLift = 1 - distanceFromCenter;
      const wave = (Math.sin(seed * 0.013 + index * 0.72) + 1) / 2;
      const pulse = (Math.cos(seed * 0.019 + index * 1.18) + 1) / 2;
      const scale = Math.min(1, 0.18 + centerLift * 0.48 + wave * 0.34 + params.energy * 0.18);
      const minScale = Math.min(0.48, 0.1 + centerLift * 0.16 + pulse * 0.08);

      return {
        delay: `${(index % 14) * -0.075}s`,
        max: scale.toFixed(3),
        min: minScale.toFixed(3),
      };
    });
  }, [params.energy, vibe]);

  async function handleTogglePlay() {
    const engine = getVibeAudioEngine();

    if (playing) {
      engine.pause();
      onTogglePlay();
      return;
    }

    try {
      setAudioError(null);
      onTogglePlay();
      await engine.start();
    } catch (error) {
      onTogglePlay();
      setAudioError(error instanceof Error ? error.message : "浏览器音频启动失败，请再点一次播放。");
    }
  }

  useEffect(() => {
    const engine = getVibeAudioEngine();
    engine.load(vibe, params);
  }, [params, vibe]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = Date.now() - elapsedRef.current * 1000;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const root = rootRef.current;
    const title = root?.querySelector(".player__title");
    const transport = root?.querySelector(".player__transport");
    if (!title || !transport || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = [title, transport];

    gsap.killTweensOf(targets);
    if (playing) {
      gsap.to(title, {
        opacity: 0.92,
        duration: 1.8,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      gsap.to(transport, {
        y: -2,
        duration: 1.35,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      return () => gsap.killTweensOf(targets);
    }

    gsap.to(title, { opacity: 1, duration: 0.42, ease: "power2.out" });
    gsap.to(transport, { y: 0, duration: 0.3, ease: "power2.out" });
  }, [playing]);

  useEffect(() => {
    const engine = getVibeAudioEngine();
    if (!playing) {
      engine.pause();
    }
  }, [playing]);

  return (
    <div ref={rootRef} className={`player player--minimal ${playing ? "player--playing" : ""}`}>
      <span className="player__ambient player__ambient--a" aria-hidden="true" />
      <span className="player__ambient player__ambient--b" aria-hidden="true" />
      <header className="player__top">
        <button className="back" onClick={onBack}>
          ← 返回氛围
        </button>
        <span className="player__id mono">{vibe.subtitle}</span>
      </header>

      <section className="player__center">
        <div className="player__title-block">
          <h1 className="player__title">
            「{vibe.name}」
          </h1>
          <p className="player__subtitle">在虚无中永存</p>
        </div>

        <p className="player__lower-text">{vibe.tagline}</p>

        <div className="player__transport player__transport--voice" aria-label="播放器">
          <button
            className="player__voice-button"
            onClick={handleTogglePlay}
            aria-label={playing ? "暂停" : "播放"}
            aria-pressed={playing}
          >
            <span className="player__motion-tile" aria-hidden="true" />
            <span className="sr-only">{playing ? "暂停" : "播放"}</span>
          </button>
          <span className="player__elapsed mono">{formatElapsed(elapsedSeconds)}</span>
          <div className="player__waveform" aria-hidden="true">
            {visualizerBars.map((bar, index) => (
              <span
                key={`${vibe.id}-${index}`}
                className="player__wave-bar"
                style={
                  {
                    ["--bar-delay" as string]: bar.delay,
                    ["--bar-max" as string]: bar.max,
                    ["--bar-min" as string]: bar.min,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <span className="player__status sr-only">
            <span className={`dot ${playing ? "dot--live" : ""}`} />
            {playing ? "正在播放" : "已暂停"}
          </span>
          <span className="player__readout mono sr-only">
            {Math.round(params.tempo)} BPM · {pattern ? `${pattern.root} ${pattern.scale}` : vibe.subtitle}
          </span>
        </div>
        {audioError && <span className="player__audio-error">{audioError}</span>}
      </section>
    </div>
  );
}
