import aubio from "aubiojs/build/aubio.esm.js";

const BUFFER_SIZE = 4096;
const HOP_SIZE = 512;
const SAMPLE_RATE = 44100;

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pitch = null;
    this.ready = false;
    this.cache = new Float32Array(BUFFER_SIZE);
    this.cacheLength = 0;
    this.lastFrequency = 0;
    this.processCount = 0;
    this.init();
  }

  async init() {
    try {
      const { Pitch } = await aubio();
      this.pitch = new Pitch("yin", BUFFER_SIZE, HOP_SIZE, SAMPLE_RATE);
      this.ready = true;
      this.port.postMessage({ type: "status", message: "Pitch worklet ready" });
    } catch (error) {
      this.port.postMessage({
        type: "error",
        message: `Worklet init failed: ${error?.message ?? "unknown error"}`,
      });
    }
  }

  process(inputs) {
    if (!this.ready || !this.pitch) {
      return true;
    }

    const inputBus = inputs[0];
    if (!inputBus || inputBus.length === 0) {
      return true;
    }

    const input = this.pickBestChannel(inputBus);
    if (!input || input.length === 0) return true;
    this.pushSamples(input);

    while (this.cacheLength >= BUFFER_SIZE) {
      const analysis = this.cache.slice(0, BUFFER_SIZE);
      const frequency = this.pitch.do(analysis) || 0;
      const confidence = this.estimateConfidence(analysis, frequency);
      this.port.postMessage({ type: "pitch", frequency, confidence });
      this.shiftLeft(HOP_SIZE);
    }

    return true;
  }

  pickBestChannel(channels) {
    if (channels.length === 1) return channels[0];

    let bestIndex = 0;
    let bestRms = -1;
    for (let c = 0; c < channels.length; c += 1) {
      const ch = channels[c];
      let energy = 0;
      for (let i = 0; i < ch.length; i += 1) {
        energy += ch[i] * ch[i];
      }
      const rms = Math.sqrt(energy / ch.length);
      if (rms > bestRms) {
        bestRms = rms;
        bestIndex = c;
      }
    }

    this.processCount += 1;
    if (this.processCount % 120 === 0) {
      this.port.postMessage({
        type: "status",
        message: `Channel RMS best=ch${bestIndex + 1} rms=${bestRms.toFixed(5)} totalChannels=${channels.length}`,
      });
    }
    return channels[bestIndex];
  }

  pushSamples(input) {
    for (let i = 0; i < input.length; i += 1) {
      if (this.cacheLength < BUFFER_SIZE) {
        this.cache[this.cacheLength] = input[i];
        this.cacheLength += 1;
      } else {
        this.shiftLeft(1);
        this.cache[BUFFER_SIZE - 1] = input[i];
      }
    }
  }

  shiftLeft(amount) {
    if (amount <= 0) return;
    const nextLength = Math.max(0, this.cacheLength - amount);
    this.cache.copyWithin(0, amount, this.cacheLength);
    this.cache.fill(0, nextLength, BUFFER_SIZE);
    this.cacheLength = nextLength;
  }

  estimateConfidence(buffer, frequency) {
    if (frequency <= 0) {
      this.lastFrequency = 0;
      return 0;
    }

    let energy = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      energy += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(energy / buffer.length);
    // Line/instrument interfaces can have lower normalized amplitude than mic paths.
    const rmsScore = Math.min(1, rms / 0.01);
    const delta = this.lastFrequency > 0 ? Math.abs(frequency - this.lastFrequency) / this.lastFrequency : 0;
    const stability = 1 - Math.min(1, delta * 2.2);
    this.lastFrequency = frequency;
    return Math.max(0, Math.min(1, rmsScore * 0.6 + stability * 0.4));
  }
}

registerProcessor("pitch-processor", PitchProcessor);
