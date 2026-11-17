/**
 * Mel-spectrogram patches for Essentia's Discogs-EffNet model, matching its
 * TensorflowInputMusiCNN front-end: 16 kHz mono, 512-sample Hann frames every 256
 * samples, power spectrum, 96 Slaney mel bands (0–8 kHz, area-normalised),
 * log10(1 + 10000·x), cut into 128-frame patches every 62 frames.
 */
export const MEL_SR = 16000;
const N_FFT = 512;
const HOP = 256;
const N_MELS = 96;
export const PATCH = 128;
const PATCH_HOP = 62;

// Slaney mel scale (librosa's default, htk=false).
const F_SP = 200 / 3;
const MIN_LOG_HZ = 1000;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOGSTEP = Math.log(6.4) / 27;
const hzToMel = (f: number) => (f < MIN_LOG_HZ ? f / F_SP : MIN_LOG_MEL + Math.log(f / MIN_LOG_HZ) / LOGSTEP);
const melToHz = (m: number) => (m < MIN_LOG_MEL ? m * F_SP : MIN_LOG_HZ * Math.exp(LOGSTEP * (m - MIN_LOG_MEL)));

let filters: Float32Array[] | null = null;
let window: Float32Array | null = null;
let twiddle: { cos: Float32Array; sin: Float32Array; rev: Uint16Array } | null = null;

function melFilters(): Float32Array[] {
  if (filters) return filters;
  const bins = N_FFT / 2 + 1;
  const fftFreqs = Float64Array.from({ length: bins }, (_, i) => (i * MEL_SR) / N_FFT);
  const lo = hzToMel(0), hi = hzToMel(MEL_SR / 2);
  const melPts = Array.from({ length: N_MELS + 2 }, (_, i) => melToHz(lo + ((hi - lo) * i) / (N_MELS + 1)));
  filters = [];
  for (let m = 0; m < N_MELS; m++) {
    const [f0, f1, f2] = [melPts[m], melPts[m + 1], melPts[m + 2]];
    const enorm = 2 / (f2 - f0); // Slaney area normalisation
    const w = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const f = fftFreqs[k];
      const v = Math.max(0, Math.min((f - f0) / (f1 - f0), (f2 - f) / (f2 - f1)));
      w[k] = v * enorm;
    }
    filters.push(w);
  }
  return filters;
}

function setup() {
  if (window && twiddle) return;
  // Periodic Hann, as librosa/scipy use for STFTs.
  window = Float32Array.from({ length: N_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));
  const half = N_FFT / 2;
  const cos = new Float32Array(half), sin = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / N_FFT);
    sin[i] = Math.sin((-2 * Math.PI * i) / N_FFT);
  }
  const bits = Math.log2(N_FFT);
  const rev = new Uint16Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  twiddle = { cos, sin, rev };
}

/** In-place radix-2 FFT of one frame; returns the power spectrum (257 bins). */
function powerSpectrum(frame: Float32Array, re: Float32Array, im: Float32Array, out: Float32Array) {
  const { cos, sin, rev } = twiddle!;
  for (let i = 0; i < N_FFT; i++) {
    re[rev[i]] = frame[i];
    im[rev[i]] = 0;
  }
  for (let size = 2; size <= N_FFT; size <<= 1) {
    const halfSize = size >> 1, step = N_FFT / size;
    for (let i = 0; i < N_FFT; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const k = j * step;
        const a = i + j, b = a + halfSize;
        const tr = re[b] * cos[k] - im[b] * sin[k];
        const ti = re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  for (let k = 0; k <= N_FFT / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
}

/** The log-mel spectrogram, frames × 96 (flattened, row-major). */
export function logMel(x: Float32Array): { data: Float32Array; frames: number } {
  setup();
  const fb = melFilters();
  // Centre frames like librosa: reflect-pad half a frame on each side.
  const pad = N_FFT / 2;
  const n = x.length + 2 * pad;
  const padded = new Float32Array(n);
  padded.set(x, pad);
  for (let i = 0; i < pad; i++) {
    padded[pad - 1 - i] = x[Math.min(i + 1, x.length - 1)] ?? 0;
    padded[pad + x.length + i] = x[Math.max(x.length - 2 - i, 0)] ?? 0;
  }
  const frames = Math.max(0, 1 + Math.floor((n - N_FFT) / HOP));
  const data = new Float32Array(frames * N_MELS);
  const frame = new Float32Array(N_FFT), re = new Float32Array(N_FFT), im = new Float32Array(N_FFT);
  const pow = new Float32Array(N_FFT / 2 + 1);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < N_FFT; i++) frame[i] = padded[off + i] * window![i];
    powerSpectrum(frame, re, im, pow);
    for (let m = 0; m < N_MELS; m++) {
      const w = fb[m];
      let s = 0;
      for (let k = 0; k < w.length; k++) s += w[k] * pow[k];
      data[f * N_MELS + m] = Math.log10(1 + 10000 * s);
    }
  }
  return { data, frames };
}

/** 128-frame patches every 62 frames, ready for the model: [n, 128, 96]. */
export function melPatches(x: Float32Array): { data: Float32Array; count: number } {
  const { data: mel, frames } = logMel(x);
  if (frames < PATCH) {
    // Short clip: zero-pad one patch.
    const out = new Float32Array(PATCH * N_MELS);
    out.set(mel);
    return { data: out, count: 1 };
  }
  const count = 1 + Math.floor((frames - PATCH) / PATCH_HOP);
  const out = new Float32Array(count * PATCH * N_MELS);
  for (let p = 0; p < count; p++) out.set(mel.subarray(p * PATCH_HOP * N_MELS, (p * PATCH_HOP + PATCH) * N_MELS), p * PATCH * N_MELS);
  return { data: out, count };
}

export const MEL_BANDS = N_MELS;
