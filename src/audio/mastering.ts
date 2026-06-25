type SuperdoughControllerModule = {
  getSuperdoughAudioController?: () => {
    output?: MasteredSuperdoughOutput | SuperdoughOutputLike;
    reset?: () => void;
    nodes?: Record<string, Disconnectable>;
    buses?: Record<string, Disconnectable>;
    __vibeLiveSafeReset?: boolean;
  };
  setGainCurve?: (curve: (value: number) => number) => void;
};

type Disconnectable = {
  disconnect?: () => void;
};

type SuperdoughOutputLike = Disconnectable & {
  reset?: () => void;
};

type MasteredOutputNodes = {
  channelMerger: ChannelMergerNode;
  inputGain: GainNode;
  highpass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  ceilingGain: GainNode;
};

type OutputConnection = {
  input: AudioNode;
  stereoMix: StereoPannerNode;
  splitter: ChannelSplitterNode;
};

function disconnectNode(node: AudioNode | null | undefined) {
  try {
    node?.disconnect();
  } catch {
    // The graph can already be disconnected after repl.stop().
  }
}

function disconnectTarget(target: Disconnectable | null | undefined) {
  try {
    target?.disconnect?.();
  } catch {
    // Superdough can call reset after the same orbit or bus was already hushed.
  }
}

class MasteredSuperdoughOutput {
  private nodes?: MasteredOutputNodes;
  private connections: OutputConnection[] = [];

  constructor(private readonly audioContext: AudioContext) {
    this.initializeAudio();
  }

  private initializeAudio() {
    const channelCount = Math.max(2, this.audioContext.destination.channelCount || 2);
    try {
      this.audioContext.destination.channelCount = Math.min(
        this.audioContext.destination.maxChannelCount || channelCount,
        channelCount,
      );
    } catch {
      // Some WebAudio implementations keep destination channelCount readonly.
    }

    const channelMerger = new ChannelMergerNode(this.audioContext, { numberOfInputs: channelCount });
    const inputGain = new GainNode(this.audioContext, { gain: 0.84 });
    const highpass = new BiquadFilterNode(this.audioContext, {
      type: "highpass",
      frequency: 24,
      Q: 0.55,
    });
    const compressor = new DynamicsCompressorNode(this.audioContext, {
      threshold: -18,
      knee: 18,
      ratio: 6,
      attack: 0.005,
      release: 0.18,
    });
    const ceilingGain = new GainNode(this.audioContext, { gain: 0.9 });

    channelMerger.connect(inputGain);
    inputGain.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(ceilingGain);
    ceilingGain.connect(this.audioContext.destination);

    this.nodes = {
      channelMerger,
      inputGain,
      highpass,
      compressor,
      ceilingGain,
    };
  }

  reset() {
    this.disconnect();
    this.initializeAudio();
  }

  disconnect() {
    this.connections.forEach(({ input, stereoMix, splitter }) => {
      disconnectNode(input);
      disconnectNode(stereoMix);
      disconnectNode(splitter);
    });
    this.connections = [];

    if (this.nodes) {
      disconnectNode(this.nodes.channelMerger);
      disconnectNode(this.nodes.inputGain);
      disconnectNode(this.nodes.highpass);
      disconnectNode(this.nodes.compressor);
      disconnectNode(this.nodes.ceilingGain);
    }
    this.nodes = undefined;
  }

  connectToDestination = (input: AudioNode, channels: number[] = [0, 1]) => {
    if (!this.nodes) this.initializeAudio();
    if (!this.nodes) return;

    const stereoMix = new StereoPannerNode(this.audioContext);
    const splitter = new ChannelSplitterNode(this.audioContext, {
      numberOfOutputs: Math.max(2, stereoMix.channelCount || 2),
    });
    const channelMerger = this.nodes.channelMerger;

    try {
      input.connect(stereoMix);
      stereoMix.connect(splitter);
      channels.forEach((channel, index) => {
        splitter.connect(
          channelMerger,
          index % Math.max(1, stereoMix.channelCount || 2),
          channel % Math.max(2, this.audioContext.destination.channelCount || 2),
        );
      });
      this.connections.push({ input, stereoMix, splitter });
    } catch (error) {
      disconnectNode(input);
      disconnectNode(stereoMix);
      disconnectNode(splitter);
      throw error;
    }
  };
}

function installSafeControllerReset(controller: ReturnType<NonNullable<SuperdoughControllerModule["getSuperdoughAudioController"]>>) {
  if (!controller || controller.__vibeLiveSafeReset) return;

  controller.reset = function reset() {
    Object.values(this.nodes ?? {}).forEach(disconnectTarget);
    Object.values(this.buses ?? {}).forEach(disconnectTarget);
    this.nodes = {};
    this.buses = {};
    try {
      this.output?.reset?.();
    } catch {
      disconnectTarget(this.output);
    }
  };
  controller.__vibeLiveSafeReset = true;
}

export function installSuperdoughMastering(
  audioContext: AudioContext,
  controllerModule: SuperdoughControllerModule,
) {
  const controller = controllerModule.getSuperdoughAudioController?.();
  if (!controller) return false;

  installSafeControllerReset(controller);

  if (!(controller.output instanceof MasteredSuperdoughOutput)) {
    disconnectTarget(controller.output);
    controller.output = new MasteredSuperdoughOutput(audioContext);
  }

  controllerModule.setGainCurve?.((value) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(0.96, value)) : 0;
    return safeValue ** 1.08;
  });

  return true;
}
