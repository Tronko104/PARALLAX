/**
 * PARALLAX — Procedural WebAudio Deep-Space Ambience & Radio Telemetry Sonification
 * Generates real-time acoustic feedback and cosmic microwave/stellar wind soundscapes
 * modulated by spatial scale and astrophysical state.
 */

export class CosmicSoundscape {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.filter = null;
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
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.14 : 0.0, now, 0.35);
    }
    return this.enabled;
  }

  initAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 260;
    this.filter.Q.value = 2.2;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.value = 55.0; // A1 sub-harmonic

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 82.41; // E2 fifth harmonic

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = 0.35;

    this.droneOsc1.connect(this.filter);
    this.droneOsc2.connect(osc2Gain);
    osc2Gain.connect(this.filter);

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  updateScaleTone(logScale, starTempK = 5778) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Map scale 25 -> 0 to harmonic frequency & filter cutoff
    const norm = Math.max(0, Math.min(1, (25.5 - logScale) / 25.5));
    const baseFreq = 48.0 + norm * 34.0 + (starTempK / 40000) * 14.0;
    this.droneOsc1.frequency.setTargetAtTime(baseFreq, now, 0.4);
    this.droneOsc2.frequency.setTargetAtTime(baseFreq * 1.498, now, 0.4);
    this.filter.frequency.setTargetAtTime(160 + norm * 320, now, 0.4);
  }

  playTelemetryPing(freq = 580, duration = 0.14) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + duration);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}
