"use client";

interface Props {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}

export default function Slider({ label, hint, value, min, max, unit, onChange }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  const rotation = -132 + fill * 2.64;
  const display = unit ? `${Math.round(value)} ${unit}` : `${Math.round(value * 100)}`;

  return (
    <label
      className="slider"
      title={hint}
      style={{
        ["--fill-angle" as string]: `${fill * 2.64}deg`,
        ["--rotation" as string]: `${rotation}deg`,
      }}
    >
      <span className="slider__knob" aria-hidden="true">
        <span className="slider__knob-cap" />
      </span>
      <span className="slider__label">{label}</span>
      {hint && <span className="slider__hint">{hint}</span>}
      <span className="slider__val mono">{display}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={unit ? 1 : 0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}
