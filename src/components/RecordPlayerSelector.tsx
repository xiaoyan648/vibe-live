"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vibe } from "@/data/vibes";

interface Props {
  vibes: Vibe[];
  onPreview: (vibe: Vibe) => void;
  onSelect: (vibe: Vibe) => void;
}

export default function RecordPlayerSelector({ vibes, onPreview, onSelect }: Props) {
  const [index, setIndex] = useState(vibes.length - 1);
  const drag = useRef<{ active: boolean; startX: number; lastX: number }>({
    active: false,
    startX: 0,
    lastX: 0,
  });
  const active = vibes[index];

  const toneStyle = useMemo(
    () => ({
      ["--record-accent" as string]: active.palette.accent,
      ["--record-accent-2" as string]: active.palette.accent2,
    }),
    [active],
  );

  useEffect(() => {
    onPreview(active);
  }, [active, onPreview]);

  function move(delta: number) {
    setIndex((current) => (current + delta + vibes.length) % vibes.length);
  }

  function setFromPointer(delta: number) {
    if (Math.abs(delta) < 38) return;
    move(delta > 0 ? -1 : 1);
  }

  return (
    <section className="record-selector" style={toneStyle} aria-label="选择氛围唱片">
      <div className="record-selector__head">
        <div>
          <h2>选择唱片</h2>
          <p>拖动唱片架，或切换按钮，把一个氛围放上转盘。</p>
        </div>
        <div className="record-selector__controls" aria-label="切换唱片">
          <button type="button" onClick={() => move(-1)} aria-label="上一张唱片">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" onClick={() => move(1)} aria-label="下一张唱片">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="turntable" aria-live="polite">
        <div className="turntable__plinth">
          <div className="turntable__record" key={active.id}>
            <span className="record__shine" aria-hidden="true" />
            <span className="record__grooves" aria-hidden="true" />
            <span className="record__label">
              <span>{active.name}</span>
              <small className="mono">{active.subtitle}</small>
            </span>
          </div>
          <div className="turntable__spindle" aria-hidden="true" />
          <div className="tonearm" aria-hidden="true">
            <span className="tonearm__base" />
            <span className="tonearm__wand" />
            <span className="tonearm__head" />
          </div>
        </div>

        <div className="turntable__meta">
          <span className="turntable__glyph" aria-hidden="true">
            {active.glyph}
          </span>
          <div>
            <h3>{active.name}</h3>
            <p>{active.tagline}</p>
          </div>
          <button type="button" className="turntable__play" onClick={() => onSelect(active)}>
            播放这个氛围
          </button>
        </div>
      </div>

      <div
        className="sleeve-rail"
        role="listbox"
        aria-label="唱片架"
        aria-activedescendant={`vibe-sleeve-${active.id}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
          if (event.key === "Enter") onSelect(active);
        }}
        onPointerDown={(event) => {
          drag.current = { active: true, startX: event.clientX, lastX: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          drag.current.lastX = event.clientX;
        }}
        onPointerUp={(event) => {
          if (!drag.current.active) return;
          setFromPointer(drag.current.lastX - drag.current.startX);
          drag.current.active = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current.active = false;
        }}
      >
        <div
          className="sleeve-rail__track"
          style={{ ["--rail-offset" as string]: `-${index * 9.4}rem` }}
        >
          {vibes.map((vibe, vibeIndex) => (
            <button
              id={`vibe-sleeve-${vibe.id}`}
              type="button"
              role="option"
              aria-selected={vibeIndex === index}
              key={vibe.id}
              className={`sleeve ${vibeIndex === index ? "sleeve--active" : ""}`}
              style={{
                ["--sleeve-accent" as string]: vibe.palette.accent,
                ["--sleeve-accent-2" as string]: vibe.palette.accent2,
              }}
              onClick={() => setIndex(vibeIndex)}
            >
              <span className="sleeve__disc" aria-hidden="true" />
              <span className="sleeve__name">{vibe.name}</span>
              <span className="sleeve__sub mono">{vibe.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
