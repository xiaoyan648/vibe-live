import { normalizeFft, type FftFrame } from "./analyser";
import { buildStrudelCode } from "./strudelCode";
import { installSuperdoughMastering } from "./mastering";
import type { Vibe, VibeParams } from "@/data/vibes";

type StrudelRepl = {
  evaluate: (code: string, autostart?: boolean, shouldHush?: boolean) => Promise<unknown>;
  start: () => void;
  pause: () => void;
  stop: () => void;
  scheduler?: {
    start: () => void;
    pause: () => void;
    stop: () => void;
  };
};

type StrudelRuntime = {
  repl: StrudelRepl;
  getAnalyzerData: (type?: "time" | "frequency", id?: number) => Float32Array | number[];
  getAudioContext: () => AudioContext;
};

class VibeAudioEngine {
  private runtime?: StrudelRuntime;
  private runtimePromise?: Promise<StrudelRuntime>;
  private currentVibe?: Vibe;
  private currentParams?: VibeParams;
  private currentCode = "";
  private appliedCode = "";
  private started = false;
  private applying?: Promise<void>;
  private applyTimer?: ReturnType<typeof setTimeout>;

  load(vibe: Vibe, params: VibeParams) {
    this.currentVibe = vibe;
    this.currentParams = params;
    this.currentCode = buildStrudelCode(vibe, params);
    if (this.started) {
      this.scheduleApplyPattern();
    }
  }

  private scheduleApplyPattern() {
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
    }

    this.applyTimer = setTimeout(() => {
      this.applyTimer = undefined;
      void this.applyPattern().catch(() => {
        this.started = false;
      });
    }, 80);
  }

  applyParams(params: VibeParams) {
    if (!this.currentVibe) return;
    this.load(this.currentVibe, params);
  }

  async start() {
    const runtime = await this.ensureRuntime();
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
      this.applyTimer = undefined;
    }
    if (!this.currentCode && this.currentVibe && this.currentParams) {
      this.currentCode = buildStrudelCode(this.currentVibe, this.currentParams);
    }
    await this.applyPattern();
    await runtime.getAudioContext().resume?.();
    runtime.repl.start();
    this.started = true;
  }

  pause() {
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
      this.applyTimer = undefined;
    }
    this.runtime?.repl.pause();
    this.started = false;
  }

  stop() {
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
      this.applyTimer = undefined;
    }
    this.runtime?.repl.stop();
    this.started = false;
  }

  getFft(): FftFrame {
    if (!this.runtime || !this.started) return [];
    try {
      return normalizeFft(this.runtime.getAnalyzerData("frequency", 1));
    } catch {
      return [];
    }
  }

  private async applyPattern() {
    if (this.applying) {
      await this.applying.catch(() => undefined);
    }

    const runtime = await this.ensureRuntime();
    const code = this.currentCode;
    if (!code || code === this.appliedCode) return;
    const fallbackCode =
      this.currentVibe && this.currentParams
        ? buildStrudelCode(this.currentVibe, this.currentParams, { preferNative: false })
        : "";

    this.applying = runtime.repl
      .evaluate(code, false, true)
      .catch(async (error: unknown) => {
        if (fallbackCode && fallbackCode !== code) {
          console.warn("[vibelive:strudel] native pattern failed, falling back to structured pattern", error);
          await runtime.repl.evaluate(fallbackCode, false, true);
          this.currentCode = fallbackCode;
          return;
        }
        throw error;
      })
      .then(() => {
        this.appliedCode = this.currentCode === fallbackCode ? fallbackCode : code;
      })
      .finally(() => {
        this.applying = undefined;
      });
    await this.applying;

    if (this.currentCode && this.currentCode !== this.appliedCode) {
      await this.applyPattern();
    }
  }

  private async ensureRuntime() {
    if (this.runtime) return this.runtime;
    if (!this.runtimePromise) {
      this.runtimePromise = this.createRuntime();
    }
    this.runtime = await this.runtimePromise;
    return this.runtime;
  }

  private async createRuntime(): Promise<StrudelRuntime> {
    const [core, { miniAllStrings }, webaudio] = await Promise.all([
      import("@strudel/core"),
      import("@strudel/mini"),
      import("@strudel/webaudio"),
    ]);

    await core.evalScope(core);
    miniAllStrings();

    const {
      getAudioContext,
      initAudio,
      registerSynthSounds,
      samples,
      webaudioRepl,
      getAnalyzerData,
    } = webaudio as typeof import("@strudel/webaudio");

    registerSynthSounds();
    const samplePromise = samples("github:tidalcycles/dirt-samples").catch((error: unknown) => {
      console.warn("[vibelive:strudel] sample map failed, synth fallback remains available", error);
    });

    await initAudio({
      maxPolyphony: 64,
      disableWorklets: false,
    }).catch((error: unknown) => {
      console.warn("[vibelive:strudel] audio worklet init failed, continuing with fallback path", error);
    });
    await samplePromise;

    const audioContext = getAudioContext();
    installSuperdoughMastering(audioContext, webaudio);
    const repl = webaudioRepl({
      getTime: () => audioContext.currentTime,
    }) as StrudelRepl;

    return {
      repl,
      getAnalyzerData,
      getAudioContext,
    };
  }
}

let engine: VibeAudioEngine | null = null;

export function getVibeAudioEngine() {
  if (!engine) engine = new VibeAudioEngine();
  return engine;
}
