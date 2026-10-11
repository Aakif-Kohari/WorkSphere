/**
 * transient_detector.c
 * Isolates sharp audio transients (e.g., espresso machine steam, dropping cups)
 * from continuous background noise. Uses energy envelope tracking and
 * thresholding to flag transient events.
 */

#include <math.h>
#include <stdint.h>
#include <stdlib.h>

#define FRAME_SIZE 512
#define ATTACK_TIME_MS 10.0f
#define RELEASE_TIME_MS 100.0f
#define DEFAULT_SAMPLE_RATE 44100.0f
#define MIN_SAMPLE_RATE 8000.0f
#define MAX_SAMPLE_RATE 192000.0f

typedef struct {
  float envelope;
  float threshold;
  float attack_coeff;
  float release_coeff;
  int transient_detected;
} TransientState;

/**
 * Initializes transient detector state and computes filter coefficients.
 * Validates that sample_rate > 8000.0f && sample_rate < 192000.0f.
 * Returns 0 on success, or -1 if sample_rate is invalid / NaN / out-of-range.
 * On invalid sample_rate, falls back to DEFAULT_SAMPLE_RATE coefficients to
 * prevent NaN / divide-by-zero propagation.
 */
int transient_init(TransientState *state, float sample_rate) {
  if (!state) {
    return -1;
  }

  // Sanity check: sample_rate > 8000 && sample_rate < 192000
  // Guards against NaN, Inf, zero, negative, and out-of-range sample rates
  if (isnan(sample_rate) || isinf(sample_rate) ||
      !(sample_rate > MIN_SAMPLE_RATE && sample_rate < MAX_SAMPLE_RATE)) {
    state->envelope = 0.0f;
    state->threshold = 0.1f;
    state->attack_coeff =
        expf(-1.0f / (DEFAULT_SAMPLE_RATE * (ATTACK_TIME_MS / 1000.0f)));
    state->release_coeff =
        expf(-1.0f / (DEFAULT_SAMPLE_RATE * (RELEASE_TIME_MS / 1000.0f)));
    state->transient_detected = 0;
    return -1;
  }

  state->envelope = 0.0f;
  state->threshold = 0.1f; // Initial threshold
  state->attack_coeff =
      expf(-1.0f / (sample_rate * (ATTACK_TIME_MS / 1000.0f)));
  state->release_coeff =
      expf(-1.0f / (sample_rate * (RELEASE_TIME_MS / 1000.0f)));
  state->transient_detected = 0;
  return 0;
}

/**
 * Alias for transient_init for API consistency across WASM module loaders.
 */
int init_transient_detector(TransientState *state, float sample_rate) {
  return transient_init(state, sample_rate);
}

int detect_transients(const float *audio_frame, int num_samples,
                      TransientState *state, float sample_rate) {
  if (!audio_frame || !state || num_samples <= 0)
    return 0;

  // Guard against uninitialized or NaN filter coefficients
  if (isnan(state->attack_coeff) || isnan(state->release_coeff) ||
      state->attack_coeff <= 0.0f || state->release_coeff <= 0.0f) {
    float safe_rate =
        (sample_rate > MIN_SAMPLE_RATE && sample_rate < MAX_SAMPLE_RATE &&
         !isnan(sample_rate) && !isinf(sample_rate))
            ? sample_rate
            : DEFAULT_SAMPLE_RATE;
    state->attack_coeff =
        expf(-1.0f / (safe_rate * (ATTACK_TIME_MS / 1000.0f)));
    state->release_coeff =
        expf(-1.0f / (safe_rate * (RELEASE_TIME_MS / 1000.0f)));
  }

  int transient_count = 0;
  float max_amplitude = 0.0f;

  // Find max amplitude in frame
  for (int i = 0; i < num_samples; i++) {
    float sample = audio_frame[i];
    if (isnan(sample))
      continue;
    float abs_val = fabsf(sample);
    if (abs_val > max_amplitude) {
      max_amplitude = abs_val;
    }
  }

  // Update envelope
  if (max_amplitude > state->envelope) {
    state->envelope =
        max_amplitude + state->attack_coeff * (state->envelope - max_amplitude);
  } else {
    state->envelope = max_amplitude +
                      state->release_coeff * (state->envelope - max_amplitude);
  }

  // Adaptive thresholding
  state->threshold = state->envelope * 1.5f + 0.01f;

  if (max_amplitude > state->threshold && state->envelope > 0.05f) {
    state->transient_detected = 1;
    transient_count = 1;
  } else {
    state->transient_detected = 0;
  }

  return transient_count;
}

float get_transient_density(const TransientState *state) {
  return state ? (state->transient_detected ? 1.0f : 0.0f) : 0.0f;
}
