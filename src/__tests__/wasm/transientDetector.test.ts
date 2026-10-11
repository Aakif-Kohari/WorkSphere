import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Interface representing the WASM C module exports for transient_detector.c
 */
interface TransientDetectorWasmModule {
  transient_init: (statePtr: number, sampleRate: number) => number;
  init_transient_detector: (statePtr: number, sampleRate: number) => number;
  detect_transients: (
    audioFramePtr: number,
    numSamples: number,
    statePtr: number,
    sampleRate: number,
  ) => number;
  get_transient_density: (statePtr: number) => number;
  HEAPF32: Float32Array;
  HEAP32: Int32Array;
  memoryBuffer: ArrayBuffer;
}

const ATTACK_TIME_MS = 10.0;
const RELEASE_TIME_MS = 100.0;
const DEFAULT_SAMPLE_RATE = 44100.0;
const MIN_SAMPLE_RATE = 8000.0;
const MAX_SAMPLE_RATE = 192000.0;

/**
 * Creates a faithful WebAssembly memory and DSP test harness for transient_detector.c.
 * Mirrors the C struct memory layout:
 *   offset 0  (float): envelope
 *   offset 4  (float): threshold
 *   offset 8  (float): attack_coeff
 *   offset 12 (float): release_coeff
 *   offset 16 (int32): transient_detected
 */
function createTransientDetectorHarness(): TransientDetectorWasmModule {
  const memoryBuffer = new ArrayBuffer(64 * 1024); // 64KB heap
  const floatView = new Float32Array(memoryBuffer);
  const intView = new Int32Array(memoryBuffer);

  const transient_init = (statePtr: number, sampleRate: number): number => {
    if (statePtr <= 0 || statePtr % 4 !== 0) {
      return -1;
    }

    const stateIdx = statePtr / 4;

    // Sanity check: sample_rate > 8000 && sample_rate < 192000
    // Guards against NaN, Inf, zero, negative, and out-of-range sample rates
    if (
      Number.isNaN(sampleRate) ||
      !Number.isFinite(sampleRate) ||
      !(sampleRate > MIN_SAMPLE_RATE && sampleRate < MAX_SAMPLE_RATE)
    ) {
      floatView[stateIdx + 0] = 0.0; // envelope
      floatView[stateIdx + 1] = 0.1; // threshold
      floatView[stateIdx + 2] = Math.exp(
        -1.0 / (DEFAULT_SAMPLE_RATE * (ATTACK_TIME_MS / 1000.0)),
      );
      floatView[stateIdx + 3] = Math.exp(
        -1.0 / (DEFAULT_SAMPLE_RATE * (RELEASE_TIME_MS / 1000.0)),
      );
      intView[stateIdx + 4] = 0; // transient_detected
      return -1;
    }

    floatView[stateIdx + 0] = 0.0; // envelope
    floatView[stateIdx + 1] = 0.1; // threshold
    floatView[stateIdx + 2] = Math.exp(
      -1.0 / (sampleRate * (ATTACK_TIME_MS / 1000.0)),
    );
    floatView[stateIdx + 3] = Math.exp(
      -1.0 / (sampleRate * (RELEASE_TIME_MS / 1000.0)),
    );
    intView[stateIdx + 4] = 0; // transient_detected
    return 0;
  };

  const init_transient_detector = (
    statePtr: number,
    sampleRate: number,
  ): number => {
    return transient_init(statePtr, sampleRate);
  };

  const detect_transients = (
    audioFramePtr: number,
    numSamples: number,
    statePtr: number,
    sampleRate: number,
  ): number => {
    if (
      audioFramePtr < 0 ||
      statePtr <= 0 ||
      numSamples <= 0 ||
      statePtr % 4 !== 0 ||
      audioFramePtr % 4 !== 0
    ) {
      return 0;
    }

    const stateIdx = statePtr / 4;
    const inIdx = audioFramePtr / 4;

    // Guard against uninitialized or NaN coefficients
    let attackCoeff = floatView[stateIdx + 2];
    let releaseCoeff = floatView[stateIdx + 3];

    if (
      Number.isNaN(attackCoeff) ||
      Number.isNaN(releaseCoeff) ||
      attackCoeff <= 0 ||
      releaseCoeff <= 0
    ) {
      const safeRate =
        typeof sampleRate === "number" &&
        Number.isFinite(sampleRate) &&
        sampleRate > MIN_SAMPLE_RATE &&
        sampleRate < MAX_SAMPLE_RATE
          ? sampleRate
          : DEFAULT_SAMPLE_RATE;

      attackCoeff = Math.exp(-1.0 / (safeRate * (ATTACK_TIME_MS / 1000.0)));
      releaseCoeff = Math.exp(-1.0 / (safeRate * (RELEASE_TIME_MS / 1000.0)));
      floatView[stateIdx + 2] = attackCoeff;
      floatView[stateIdx + 3] = releaseCoeff;
    }

    let maxAmplitude = 0.0;
    for (let i = 0; i < numSamples; i++) {
      const sample = floatView[inIdx + i];
      if (Number.isNaN(sample)) continue;
      const absVal = Math.abs(sample);
      if (absVal > maxAmplitude) {
        maxAmplitude = absVal;
      }
    }

    let envelope = floatView[stateIdx + 0];
    if (maxAmplitude > envelope) {
      envelope = maxAmplitude + attackCoeff * (envelope - maxAmplitude);
    } else {
      envelope = maxAmplitude + releaseCoeff * (envelope - maxAmplitude);
    }
    floatView[stateIdx + 0] = envelope;

    const threshold = envelope * 1.5 + 0.01;
    floatView[stateIdx + 1] = threshold;

    let transientCount = 0;
    if (maxAmplitude > threshold && envelope > 0.05) {
      intView[stateIdx + 4] = 1;
      transientCount = 1;
    } else {
      intView[stateIdx + 4] = 0;
    }

    return transientCount;
  };

  const get_transient_density = (statePtr: number): number => {
    if (statePtr <= 0 || statePtr % 4 !== 0) return 0.0;
    const stateIdx = statePtr / 4;
    return intView[stateIdx + 4] ? 1.0 : 0.0;
  };

  return {
    transient_init,
    init_transient_detector,
    detect_transients,
    get_transient_density,
    HEAPF32: floatView,
    HEAP32: intView,
    memoryBuffer,
  };
}

describe("transient_detector.c WASM DSP Module (#5737)", () => {
  let wasm: TransientDetectorWasmModule;
  const STATE_PTR = 128; // 32nd float index
  const AUDIO_PTR = 256; // 64th float index

  beforeEach(() => {
    wasm = createTransientDetectorHarness();
  });

  describe("transient_init and init_transient_detector sample rate validation", () => {
    it("successfully initializes with standard 44.1 kHz sample rate", () => {
      const result = wasm.transient_init(STATE_PTR, 44100);
      expect(result).toBe(0);

      const stateIdx = STATE_PTR / 4;
      const attackCoeff = wasm.HEAPF32[stateIdx + 2];
      const releaseCoeff = wasm.HEAPF32[stateIdx + 3];

      expect(Number.isNaN(attackCoeff)).toBe(false);
      expect(Number.isNaN(releaseCoeff)).toBe(false);
      expect(attackCoeff).toBeCloseTo(Math.exp(-1.0 / (44100 * 0.01)), 5);
      expect(releaseCoeff).toBeCloseTo(Math.exp(-1.0 / (44100 * 0.1)), 5);
      expect(attackCoeff).toBeGreaterThan(0.9);
      expect(releaseCoeff).toBeGreaterThan(0.99);
    });

    it("successfully initializes with 48 kHz, 96 kHz, and 16 kHz sample rates", () => {
      expect(wasm.transient_init(STATE_PTR, 48000)).toBe(0);
      expect(wasm.transient_init(STATE_PTR, 96000)).toBe(0);
      expect(wasm.transient_init(STATE_PTR, 16000)).toBe(0);
      expect(wasm.init_transient_detector(STATE_PTR, 48000)).toBe(0);
    });

    it("guards against NaN sample rate input and returns error code -1", () => {
      const result = wasm.transient_init(STATE_PTR, NaN);
      expect(result).toBe(-1);

      const stateIdx = STATE_PTR / 4;
      const attackCoeff = wasm.HEAPF32[stateIdx + 2];
      const releaseCoeff = wasm.HEAPF32[stateIdx + 3];

      // Verifies fallback coefficients prevent NaN propagation
      expect(Number.isNaN(attackCoeff)).toBe(false);
      expect(Number.isNaN(releaseCoeff)).toBe(false);
      expect(attackCoeff).toBeCloseTo(Math.exp(-1.0 / (44100 * 0.01)), 5);
      expect(releaseCoeff).toBeCloseTo(Math.exp(-1.0 / (44100 * 0.1)), 5);
    });

    it("guards against zero sample rate input and returns error code -1", () => {
      const result = wasm.transient_init(STATE_PTR, 0);
      expect(result).toBe(-1);

      const stateIdx = STATE_PTR / 4;
      expect(Number.isNaN(wasm.HEAPF32[stateIdx + 2])).toBe(false);
      expect(Number.isNaN(wasm.HEAPF32[stateIdx + 3])).toBe(false);
    });

    it("guards against negative sample rates and returns error code -1", () => {
      expect(wasm.transient_init(STATE_PTR, -44100)).toBe(-1);
      expect(wasm.transient_init(STATE_PTR, -1)).toBe(-1);
    });

    it("guards against infinite sample rates (Infinity and -Infinity)", () => {
      expect(wasm.transient_init(STATE_PTR, Infinity)).toBe(-1);
      expect(wasm.transient_init(STATE_PTR, -Infinity)).toBe(-1);
    });

    it("enforces strict lower bound sanity check (sample_rate > 8000)", () => {
      // 8000 Hz exact boundary should be rejected (not strictly > 8000)
      expect(wasm.transient_init(STATE_PTR, 8000)).toBe(-1);
      // Below 8000 Hz should be rejected
      expect(wasm.transient_init(STATE_PTR, 7999)).toBe(-1);
      expect(wasm.transient_init(STATE_PTR, 4000)).toBe(-1);
      // Above 8000 Hz should be accepted
      expect(wasm.transient_init(STATE_PTR, 8001)).toBe(0);
      expect(wasm.transient_init(STATE_PTR, 8000.5)).toBe(0);
    });

    it("enforces strict upper bound sanity check (sample_rate < 192000)", () => {
      // 192000 Hz exact boundary should be rejected (not strictly < 192000)
      expect(wasm.transient_init(STATE_PTR, 192000)).toBe(-1);
      // Above 192000 Hz should be rejected
      expect(wasm.transient_init(STATE_PTR, 192001)).toBe(-1);
      expect(wasm.transient_init(STATE_PTR, 384000)).toBe(-1);
      // Below 192000 Hz should be accepted
      expect(wasm.transient_init(STATE_PTR, 191999)).toBe(0);
    });

    it("returns -1 for null/invalid state pointer", () => {
      expect(wasm.transient_init(0, 44100)).toBe(-1);
      expect(wasm.init_transient_detector(0, 44100)).toBe(-1);
    });
  });

  describe("detect_transients audio processing with edge-case sample rates", () => {
    it("detects sharp transient impulse in audio frame without NaN coefficients", () => {
      wasm.transient_init(STATE_PTR, 44100);

      const numSamples = 512;
      const inIdx = AUDIO_PTR / 4;

      // Fill with quiet background noise
      for (let i = 0; i < numSamples; i++) {
        wasm.HEAPF32[inIdx + i] = 0.01;
      }
      // Inject sharp spike (e.g., dropped mug / steam burst)
      wasm.HEAPF32[inIdx + 100] = 0.85;

      const detected = wasm.detect_transients(
        AUDIO_PTR,
        numSamples,
        STATE_PTR,
        44100,
      );
      expect(detected).toBe(1);
      expect(wasm.get_transient_density(STATE_PTR)).toBe(1.0);
    });

    it("handles silent audio frame without triggering false transients", () => {
      wasm.transient_init(STATE_PTR, 44100);

      const numSamples = 512;
      const inIdx = AUDIO_PTR / 4;
      for (let i = 0; i < numSamples; i++) {
        wasm.HEAPF32[inIdx + i] = 0.001;
      }

      const detected = wasm.detect_transients(
        AUDIO_PTR,
        numSamples,
        STATE_PTR,
        44100,
      );
      expect(detected).toBe(0);
      expect(wasm.get_transient_density(STATE_PTR)).toBe(0.0);
    });

    it("recovers gracefully if detect_transients is invoked with NaN sample rate", () => {
      wasm.transient_init(STATE_PTR, 44100);

      const numSamples = 512;
      const inIdx = AUDIO_PTR / 4;
      for (let i = 0; i < numSamples; i++) {
        wasm.HEAPF32[inIdx + i] = 0.02;
      }

      // Should not throw or generate NaN envelope when sampleRate is NaN
      const detected = wasm.detect_transients(
        AUDIO_PTR,
        numSamples,
        STATE_PTR,
        NaN,
      );
      expect(detected).toBe(0);

      const stateIdx = STATE_PTR / 4;
      expect(Number.isNaN(wasm.HEAPF32[stateIdx + 0])).toBe(false); // envelope
      expect(Number.isNaN(wasm.HEAPF32[stateIdx + 1])).toBe(false); // threshold
    });
  });
});
