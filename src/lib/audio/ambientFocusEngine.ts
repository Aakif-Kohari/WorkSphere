/**
 * ambientFocusEngine.ts
 * Web Audio API synthesizer for ambient background soundscapes (Rain, Cafe, Binaural Beats, Vinyl)
 * and synchronized Pomodoro sprint state machine.
 */

export type PomodoroPhase = "FOCUS_SPRINT" | "SHORT_BREAK" | "LONG_BREAK";

export interface PomodoroState {
  phase: PomodoroPhase;
  durationMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  sprintCount: number;
}

export interface SoundTrackState {
  id: "rain" | "cafe" | "vinyl" | "binaural" | "whitenoise";
  name: string;
  volume: number; // 0 to 1
  pan: number;    // -1 (Left) to +1 (Right)
  enabled: boolean;
}

export interface PeerSprintIntention {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  taskText: string;
  isCompleted: boolean;
}

export class AmbientAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private noiseNodes: Map<string, { gain: GainNode; panner: StereoPannerNode }> = new Map();
  private isMuted: boolean = false;

  public init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /**
   * Generates continuous filtered noise buffers for rain / cafe / ambient textures.
   */
  public playTrack(trackId: SoundTrackState["id"], volume: number, pan: number) {
    this.init();
    if (!this.ctx) return;

    if (this.noiseNodes.has(trackId)) {
      const node = this.noiseNodes.get(trackId)!;
      node.gain.gain.setValueAtTime(this.isMuted ? 0 : volume * 0.3, this.ctx.currentTime);
      node.panner.pan.setValueAtTime(pan, this.ctx.currentTime);
      return;
    }

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (trackId === "rain") {
        // Brown noise approximation
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
      } else if (trackId === "binaural") {
        // Low frequency hum
        output[i] = Math.sin((i / this.ctx.sampleRate) * 2 * Math.PI * 140) * 0.5;
      } else {
        // Pinkish ambient murmur
        output[i] = (lastOut + 0.05 * white) / 1.05;
        lastOut = output[i];
      }
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter node to soften high harsh frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = trackId === "rain" ? "lowpass" : "bandpass";
    filter.frequency.setValueAtTime(trackId === "rain" ? 800 : 400, this.ctx.currentTime);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.isMuted ? 0 : volume * 0.3, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
    this.noiseNodes.set(trackId, { gain, panner });
  }

  public stopTrack(trackId: string) {
    if (this.noiseNodes.has(trackId)) {
      const node = this.noiseNodes.get(trackId)!;
      if (this.ctx) {
        node.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    }
  }

  /**
   * Plays a gentle acoustic chime when Pomodoro intervals transition.
   */
  public playChime() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.3); // A5

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.8);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx) {
      for (const [_, node] of this.noiseNodes.entries()) {
        node.gain.gain.setValueAtTime(muted ? 0 : 0.15, this.ctx.currentTime);
      }
    }
  }
}
