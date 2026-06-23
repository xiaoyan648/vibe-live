"use client";

import { useEffect, useRef } from "react";
import type { Vibe, VibeParams } from "@/data/vibes";

interface Props {
  vibe: Vibe;
  params: VibeParams;
  playing: boolean;
  fft?: number[];
}

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seed: number;
}

function cssImageUrl(url?: string) {
  if (!url) return undefined;
  return `url("${url.replace(/["\\\n\r]/g, "")}")`;
}

// 这套视觉是产品的主角：跟随 vibe 主色与参数实时变化。
// 没有声音时，用时间驱动的伪振幅模拟“呼吸 / 律动”；有 Strudel analyser
// 数据时，背景会优先响应真实频谱。
export default function VibeBackground({ vibe, params, playing, fft = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 用 ref 持有最新 props，避免每帧重建动画循环
  const state = useRef({ vibe, params, playing, fft });

  useEffect(() => {
    state.current = { vibe, params, playing, fft };
  }, [fft, params, playing, vibe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    }

    function seedParticles() {
      const count = Math.floor(60 + state.current.params.density * 140);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.4,
        seed: Math.random() * Math.PI * 2,
      }));
    }

    let t = 0;
    let raf = 0;
    let lastDraw = 0;

    function frame(now: number) {
      const { vibe, params, playing, fft } = state.current;
      const targetFrameTime = reduceMotion ? 250 : playing ? 1000 / 45 : 1000 / 30;
      if (now - lastDraw < targetFrameTime) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const elapsedScale = lastDraw ? Math.min(2, (now - lastDraw) / (1000 / 60)) : 1;
      lastDraw = now;

      const accent = hexToRgb(vibe.palette.accent);
      const accent2 = hexToRgb(vibe.palette.accent2);
      const base = hexToRgb(vibe.palette.base);

      const speed = reduceMotion ? 0 : (playing ? 1 : 0.28) * (0.4 + params.energy);
      t += 0.006 * (0.5 + speed) * elapsedScale;

      const fftEnergy = fft.length ? fft.reduce((sum, value) => sum + value, 0) / fft.length : 0;
      // 有真实音频时使用 FFT；无音频数据时保留伪律动作为兜底。
      const breath = playing ? Math.max(fftEnergy, 0.5 + 0.5 * Math.sin(t * 2.2) * 0.35) : 0.18;
      const motion = playing ? 1 : 0.35;

      // 背景基底 + 暗角
      ctx!.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
      ctx!.fillRect(0, 0, width, height);

      // 大型渐变光球（氛围灯光）
      const blobs = [
        { x: 0.3 + 0.12 * Math.sin(t * 0.7), y: 0.35 + 0.1 * Math.cos(t * 0.5), c: accent },
        { x: 0.72 + 0.1 * Math.cos(t * 0.6), y: 0.6 + 0.12 * Math.sin(t * 0.8), c: accent2 },
        { x: 0.5 + 0.18 * Math.sin(t * 0.4 + 1), y: 0.5 + 0.14 * Math.cos(t * 0.3), c: accent },
      ];
      ctx!.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const cx = b.x * width;
        const cy = b.y * height;
        const radius =
          Math.max(width, height) * (0.32 + 0.12 * params.space) * (0.85 + 0.3 * breath);
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const alpha = (0.1 + 0.16 * params.brightness) * (0.6 + 0.5 * breath);
        grad.addColorStop(0, `rgba(${b.c.r},${b.c.g},${b.c.b},${alpha})`);
        grad.addColorStop(1, `rgba(${b.c.r},${b.c.g},${b.c.b},0)`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      const stageCx = width * (0.5 + 0.02 * Math.sin(t * 0.42));
      const stageCy = height * (0.54 + 0.025 * Math.cos(t * 0.38));

      // 把页面底层做成可被声音照亮的声场，而不是单纯的装饰背景。
      ctx!.save();
      ctx!.translate(stageCx, stageCy);
      ctx!.rotate(Math.sin(t * 0.22) * 0.05);
      ctx!.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i += 1) {
        const radiusX = Math.min(width, height) * (0.28 + i * 0.085 + params.space * 0.06);
        const radiusY = radiusX * (0.28 + i * 0.045);
        const c = i % 2 ? accent2 : accent;
        const alpha = (0.055 + params.brightness * 0.045) * (0.75 + breath * 0.7) * (1 - i * 0.11);
        ctx!.lineWidth = 0.8 + i * 0.28;
        ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
        ctx!.beginPath();
        ctx!.ellipse(0, 0, radiusX, radiusY, t * (0.1 + i * 0.025), 0, Math.PI * 2);
        ctx!.stroke();
      }
      ctx!.restore();

      ctx!.save();
      ctx!.globalCompositeOperation = "screen";
      const horizonY = height * (0.72 + params.space * 0.06);
      const waveAmp = (10 + params.energy * 34) * (0.45 + breath);
      for (let line = 0; line < 3; line += 1) {
        const c = line === 1 ? accent2 : accent;
        ctx!.beginPath();
        for (let x = -12; x <= width + 12; x += 9) {
          const sampleIndex = fft.length ? Math.floor((x / Math.max(width, 1)) * fft.length) : 0;
          const fftLift = (fft[sampleIndex] ?? 0) * 42;
          const y =
            horizonY +
            line * 12 +
            Math.sin(x * (0.006 + line * 0.001) + t * (1.3 + line * 0.42)) * waveAmp * (0.62 - line * 0.12) -
            fftLift * (playing ? 1 : 0.2);
          x <= -12 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.08 + params.ambience * 0.08 - line * 0.012})`;
        ctx!.lineWidth = 1.1 - line * 0.18;
        ctx!.stroke();
      }

      const bars = 54;
      const floorY = height * 0.92;
      const barWidth = width / bars;
      for (let i = 0; i < bars; i += 1) {
        const sample = fft.length ? fft[Math.floor((i / bars) * fft.length)] ?? 0 : 0;
        const idle = 0.16 + 0.12 * Math.sin(t * 1.5 + i * 0.58);
        const level = playing ? Math.max(sample, idle) : idle * 0.5;
        const c = i % 3 === 0 ? accent2 : accent;
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.025 + level * 0.11})`;
        ctx!.fillRect(i * barWidth, floorY - level * 94, Math.max(1, barWidth - 3), level * 94);
      }
      ctx!.restore();

      // 各 vibe 的标志性图层
      if (vibe.visual === "rain") {
        ctx!.globalCompositeOperation = "screen";
        ctx!.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},${0.18 + 0.22 * params.ambience})`;
        ctx!.lineWidth = 1;
        for (const p of particles) {
          const len = 9 + p.r * 8;
          p.y += (2.4 + p.r * 2.5) * (0.5 + motion);
          p.x += 0.4;
          if (p.y > height) {
            p.y = -len;
            p.x = Math.random() * width;
          }
          ctx!.beginPath();
          ctx!.moveTo(p.x, p.y);
          ctx!.lineTo(p.x - 1.5, p.y + len);
          ctx!.stroke();
        }
      } else if (vibe.visual === "waves") {
        ctx!.globalCompositeOperation = "screen";
        const lines = 5;
        for (let i = 0; i < lines; i++) {
          const yBase = (height / (lines + 1)) * (i + 1);
          const amp = (16 + 60 * params.space) * (0.4 + breath) * motion;
          ctx!.beginPath();
          for (let x = 0; x <= width; x += 8) {
            const y =
              yBase +
              Math.sin(x * 0.006 + t * 1.6 + i * 0.7) * amp +
              Math.sin(x * 0.013 - t * 0.9) * amp * 0.4;
            x === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
          }
          const c = i % 2 ? accent2 : accent;
          ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.1 + 0.18 * params.brightness})`;
          ctx!.lineWidth = 1.4;
          ctx!.stroke();
        }
      } else if (vibe.visual === "cosmos") {
        ctx!.globalCompositeOperation = "lighter";
        for (const p of particles) {
          p.x += p.vx * 0.3 * motion;
          p.y += p.vy * 0.3 * motion;
          wrap(p);
          const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.seed);
          const a = (0.25 + 0.6 * tw) * (0.4 + 0.6 * params.brightness);
          ctx!.fillStyle = `rgba(255,255,255,${a})`;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * (0.6 + tw * 0.8), 0, Math.PI * 2);
          ctx!.fill();
        }
      } else {
        // orbs / particles：漂浮粒子 + 近邻连线
        ctx!.globalCompositeOperation = "lighter";
        for (const p of particles) {
          p.x += p.vx * motion * (0.6 + params.energy);
          p.y += p.vy * motion * (0.6 + params.energy);
          wrap(p);
          const pulse = 0.6 + 0.4 * Math.sin(t * 1.5 + p.seed);
          const a = (0.18 + 0.4 * params.brightness) * pulse;
          const c = p.seed > Math.PI ? accent2 : accent;
          ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r + pulse, 0, Math.PI * 2);
          ctx!.fill();
        }
        if (vibe.visual === "orbs") {
          const linkDist = 120;
          ctx!.lineWidth = 0.6;
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const a = particles[i];
              const b = particles[j];
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < linkDist * linkDist) {
                const al = (1 - Math.sqrt(d2) / linkDist) * 0.12;
                ctx!.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},${al})`;
                ctx!.beginPath();
                ctx!.moveTo(a.x, a.y);
                ctx!.lineTo(b.x, b.y);
                ctx!.stroke();
              }
            }
          }
        }
      }

      ctx!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    function wrap(p: Particle) {
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {vibe.artwork?.imageUrl && (
        <div
          className="stage__artwork-bg"
          style={{ backgroundImage: cssImageUrl(vibe.artwork.imageUrl) }}
          aria-hidden="true"
        />
      )}
      <canvas ref={canvasRef} className="stage__canvas" aria-hidden="true" />
    </>
  );
}
