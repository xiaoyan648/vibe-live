"use client";

import type { Vibe } from "@/data/vibes";

interface Props {
  vibe: Vibe;
  onSelect: (vibe: Vibe) => void;
  onPreview?: (vibe: Vibe) => void;
  active?: boolean;
}

export default function VibeCard({ vibe, onSelect, onPreview, active = false }: Props) {
  return (
    <button
      className={`card ${active ? "card--active" : ""}`}
      style={{ ["--c-accent" as string]: vibe.palette.accent }}
      onMouseEnter={() => onPreview?.(vibe)}
      onFocus={() => onPreview?.(vibe)}
      onClick={() => onSelect(vibe)}
    >
      <span className="card__wash" aria-hidden="true" />
      <div className="card__top">
        <span className="card__glyph" aria-hidden="true">
          {vibe.glyph}
        </span>
        <span className="card__sub mono">{vibe.subtitle}</span>
      </div>
      <div className="card__body">
        <h3 className="card__name">{vibe.name}</h3>
        <p className="card__tag">{vibe.tagline}</p>
      </div>
      <span className="card__enter">播放</span>
    </button>
  );
}
