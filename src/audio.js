/**
 * Web Audio Procedural Synthesizer for SkyGame: Helibike
 * Generates dynamic propeller hum, ring collection chimes, and wind sounds.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Propeller sound nodes
    this.propOsc = null;
    this.propGain = null;
    this.propFilter = null;
    this.propLfo = null;
    this.propLfoGain = null;

    // Wind sound nodes
    this.windNode = null;
    this.windGain = null;
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Setup Continuous Propeller Synth
      this.propOsc = this.ctx.createOscillator();
      this.propOsc.type = 'sawtooth';
      this.propOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.propFilter = this.ctx.createBiquadFilter();
      this.propFilter.type = 'lowpass';
      this.propFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.propGain = this.ctx.createGain();
      this.propGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // LFO for blade chop modulation
      this.propLfo = this.ctx.createOscillator();
      this.propLfo.type = 'sine';
      this.propLfo.frequency.setValueAtTime(5, this.ctx.currentTime);

      this.propLfoGain = this.ctx.createGain();
      this.propLfoGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.propLfo.connect(this.propLfoGain.gain);
      this.propOsc.connect(this.propFilter);
      this.propFilter.connect(this.propGain);
      this.propGain.connect(this.ctx.destination);

      this.propOsc.start();
      this.propLfo.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updatePropeller(cadenceRpm) {
    if (!this.isInitialized || this.isMuted) return;

    const now = this.ctx.currentTime;
    const clampedRpm = Math.max(cadenceRpm, 15);

    // Frequency increases with RPM
    const targetFreq = 35 + (clampedRpm / 120) * 80;
    this.propOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);

    // Filter opens up as you sprint
    const filterFreq = 110 + (clampedRpm / 100) * 250;
    this.propFilter.frequency.setTargetAtTime(filterFreq, now, 0.1);

    // Blade chop speed (3 blades * revs/sec)
    const bladeChopFreq = (clampedRpm / 60) * 3 * 2;
    this.propLfo.frequency.setTargetAtTime(bladeChopFreq, now, 0.1);

    // Volume level
    const targetVolume = cadenceRpm > 5 ? Math.min(0.25, 0.08 + (cadenceRpm / 100) * 0.18) : 0.02;
    this.propGain.gain.setTargetAtTime(targetVolume, now, 0.15);
  }

  playRingChime(type) {
    if (!this.isInitialized || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    let baseFreq = 440;
    let duration = 0.4;

    if (type === 'bronze') {
      baseFreq = 523.25; // C5
    } else if (type === 'silver') {
      baseFreq = 659.25; // E5
    } else if (type === 'gold') {
      baseFreq = 880.00; // A5 - High celebratory chord!
      duration = 0.7;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type === 'gold' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + duration * 0.7);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    // Second harmonic note for gold rings
    if (type === 'gold') {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 2, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + duration);

      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc2.start(now + 0.08);
      osc2.stop(now + duration);
    }
  }

  playGemChime() {
    if (!this.isInitialized || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // E6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playThermalWhoosh() {
    if (!this.isInitialized || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.5);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}
