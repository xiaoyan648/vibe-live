export type FftFrame = number[];

export function normalizeFft(values: Float32Array | number[]): FftFrame {
  return Array.from(values, (value) => {
    if (Number.isNaN(value)) return 0;
    // Strudel/superdough 的 analyser frequency 数据通常是分贝值，约 -100 到 0。
    if (value < 0) return Math.min(1, Math.max(0, (value + 100) / 100));
    return Math.min(1, Math.max(0, value));
  });
}

export function averageFft(values: FftFrame) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
