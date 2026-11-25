/**
 * Nocturnal ambient audio engine with low-pass hover muffling and smooth fade mute/unmute.
 * Uses Web Audio API (no external audio network requests that could 404).
 */
export class ValleyAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowPass: BiquadFilterNode | null = null;
  private chimeTimer: number | null = null;
  private nodes: AudioNode[] = [];

  public isInitialized = false;
  public isMuted = true;

  public initAudio(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    // AudioContext creation/unlocking happens lazily on user toggle if suspended,
    // or immediately if browser allows it.
  }

  private ensureGraph(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.ctx) return true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 9500;
    lowPass.Q.value = 0.7;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;

    lowPass.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Warm nocturnal F#m9 harmonic pad (F#2, C#3, G#3, A3, E4)
    const freqs = [92.5, 138.59, 207.65, 220.0, 329.63];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 2) * 3.5;

      const oscGain = ctx.createGain();
      oscGain.gain.value = idx === 0 ? 0.14 : 0.055;

      // Slow organic LFO breathing per voice
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08 + idx * 0.025;
      lfoGain.gain.value = 0.022;
      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);

      osc.connect(oscGain);
      oscGain.connect(lowPass);

      osc.start();
      lfo.start();
      this.nodes.push(osc, lfo, oscGain, lfoGain);
    });

    // Soft filtered night-wind noise bed
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 2.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.1;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;

    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(lowPass);
    noise.start();
    this.nodes.push(noise, windFilter, windGain);

    // Delicate nocturnal harmonic shimmer chimes
    const chimeNotes = [659.25, 739.99, 830.61, 987.77, 1108.73];
    this.chimeTimer = window.setInterval(() => {
      if (!this.ctx || this.isMuted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = chimeNotes[Math.floor(Math.random() * chimeNotes.length)];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      osc.connect(gain);
      gain.connect(lowPass);
      osc.start(now);
      osc.stop(now + 3.5);
    }, 3600);

    this.ctx = ctx;
    this.lowPass = lowPass;
    this.masterGain = masterGain;
    return true;
  }

  public toggleMute(): boolean {
    if (!this.isInitialized) this.initAudio();
    this.isMuted = !this.isMuted;

    if (!this.isMuted) {
      if (this.ensureGraph() && this.ctx && this.masterGain) {
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume();
        }
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.45, now + 0.9);
      }
    } else if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0, now + 0.6);
    }

    return this.isMuted;
  }

  public setMuffled(muffled: boolean): void {
    if (!this.ctx || !this.lowPass) return;
    const now = this.ctx.currentTime;
    this.lowPass.frequency.cancelScheduledValues(now);
    this.lowPass.frequency.setValueAtTime(this.lowPass.frequency.value, now);
    this.lowPass.frequency.exponentialRampToValueAtTime(muffled ? 360 : 9500, now + 0.65);
  }

  public dispose(): void {
    if (this.chimeTimer !== null) {
      clearInterval(this.chimeTimer);
      this.chimeTimer = null;
    }
    this.nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.nodes = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.lowPass = null;
  }
}
