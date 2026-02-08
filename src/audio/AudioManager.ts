export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private thrustNoise: AudioBufferSourceNode | null = null;
  private thrustGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate noise buffer for collisions/thrust
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  startAmbient() {
    if (this.started) return;
    const ctx = this.ensureContext();

    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    this.droneGain.connect(this.masterGain!);

    // Deep 40Hz drone with detuned harmonics
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc1.type = "sine";
    this.droneOsc1.frequency.value = 40;
    this.droneOsc1.connect(this.droneGain);
    this.droneOsc1.start();

    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc2.type = "sine";
    this.droneOsc2.frequency.value = 40.3; // Slight detune for beating
    const gain2 = ctx.createGain();
    gain2.gain.value = 0.03;
    this.droneOsc2.connect(gain2);
    gain2.connect(this.masterGain!);
    this.droneOsc2.start();

    this.started = true;
  }

  stopAmbient() {
    if (!this.started) return;
    this.droneOsc1?.stop();
    this.droneOsc2?.stop();
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneGain = null;
    this.started = false;
  }

  playCollision(mass: number) {
    const ctx = this.ensureContext();
    if (!this.noiseBuffer || !this.masterGain) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    // Pitch by mass: heavier = lower
    filter.frequency.value = Math.max(100, 2000 / Math.sqrt(mass + 1));

    const gain = ctx.createGain();
    const vol = Math.min(0.6, 0.1 + mass * 0.01);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.4);
  }

  setThrustActive(active: boolean) {
    const ctx = this.ensureContext();
    if (!this.noiseBuffer || !this.masterGain) return;

    if (active && !this.thrustNoise) {
      this.thrustNoise = ctx.createBufferSource();
      this.thrustNoise.buffer = this.noiseBuffer;
      this.thrustNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 400;
      filter.Q.value = 2;

      this.thrustGain = ctx.createGain();
      this.thrustGain.gain.value = 0.08;

      this.thrustNoise.connect(filter);
      filter.connect(this.thrustGain);
      this.thrustGain.connect(this.masterGain);
      this.thrustNoise.start();
    } else if (!active && this.thrustNoise) {
      this.thrustNoise.stop();
      this.thrustNoise = null;
      this.thrustGain = null;
    }
  }

  setVolume(vol: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
  }

  dispose() {
    this.stopAmbient();
    this.setThrustActive(false);
    this.ctx?.close();
    this.ctx = null;
  }
}
