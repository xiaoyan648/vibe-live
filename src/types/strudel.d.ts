declare module "@strudel/core" {
  export function evalScope(...modules: unknown[]): Promise<unknown[]>;
}

declare module "@strudel/mini" {
  export function miniAllStrings(): void;
}

declare module "@strudel/webaudio" {
  export function webaudioRepl(options?: Record<string, unknown>): unknown;
  export function getAudioContext(): AudioContext;
  export function initAudio(options?: Record<string, unknown>): Promise<void>;
  export function registerSynthSounds(): void;
  export function samples(sampleMap: string | Record<string, unknown>, baseUrl?: string, options?: Record<string, unknown>): Promise<void>;
  export function getAnalyzerData(type?: "time" | "frequency", id?: number): Float32Array;
  export function getSuperdoughAudioController(): { output?: { disconnect?: () => void } };
  export function setGainCurve(curve: (value: number) => number): void;
}
