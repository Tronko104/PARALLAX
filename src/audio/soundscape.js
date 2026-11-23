/**
 * PARALLAX v2.0 — Procedural Multi-Layer WebAudio Cosmic Soundscape
 * Synthesizes real-time deep-space harmonic pads, planetary atmospheric winds,
 * warp transit resonance, and scientific telemetry chimes with zero external audio files.
 */

export class CosmicSoundscape {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.shimmerOsc = null;
    this.droneFilter = null;
    this.windGain = null;
    this.windFilter = null;
  }

  toggle() {
    if (!this.ctx) {
      this.initAudio();
    }
    this.enabled = !this.enabled;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.16 : 0.0, now, 0.45);
    }
    return this.enabled;
  }

  initAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);

    // 1. Deep-Space Sub-Harmonic & Shimmer Pad
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 240;
    this.droneFilter.Q.value = 2.0;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.value = 55.0;

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 82.41;

    this.shimmerOsc = this.ctx.createOscillator();
    this.shimmerOsc.type = 'sine';
    this.shimmerOsc.frequency.value = 164.81;

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = 0.28;
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.value = 0.09;

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(osc2Gain);
    osc2Gain.connect(this.droneFilter);
    this.shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(this.droneFilter);
    this.droneFilter.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.shimmerOsc.start();

    // 2. Procedural Pink-Noise Atmospheric Wind & Warp Transit Layer
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.02;

    noiseSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    noiseSrc.start();
  }

  updateScaleTone(logScale, starTempK = 5778, warpFactor = 0.0, pressureAtm = 1.0) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const norm = Math.max(0, Math.min(1, (25.5 - logScale) / 25.5));
    const baseFreq = 46.0 + norm * 32.0 + (Math.min(35000, starTempK) / 35000) * 14.0;

    this.droneOsc1.frequency.setTargetAtTime(baseFreq, now, 0.4);
    this.droneOsc2.frequency.setTargetAtTime(baseFreq * 1.498, now, 0.4);
    this.shimmerOsc.frequency.setTargetAtTime(baseFreq * 2.996, now, 0.4);
    this.droneFilter.frequency.setTargetAtTime(150 + norm * 290 + warpFactor * 360, now, 0.35);

    // Swell atmospheric wind when near planetary surface OR during high-speed warp transit
    const isSurface = Math.max(0, Math.min(1, (5.2 - logScale) / 2.5));
    const atmoWind = isSurface * Math.min(1.0, Math.pow(Math.max(0.01, pressureAtm), 0.35)) * 0.42;
    const warpWind = warpFactor * 0.55;
    this.windGain.gain.setTargetAtTime(0.02 + atmoWind + warpWind, now, 0.25);
    this.windFilter.frequency.setTargetAtTime(260 + isSurface * 240 + warpFactor * 520, now, 0.25);
  }

  playTelemetryPing(freq = 580, duration = 0.14) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.24, now + duration);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}
