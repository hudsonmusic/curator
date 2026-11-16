import type { Analysis, Section } from "./types";
import { camelot, keyName } from "./keys";

const hannCache = new Map<number, Float32Array>();
function hann(n: number) {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

/** In-place iterative radix-2 FFT. */
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Krumhansl–Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: ArrayLike<number>, b: ArrayLike<number>) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return num / Math.sqrt(da * db || 1);
}

function estimateKey(chroma: Float64Array) {
  const scores: { pc: number; minor: boolean; r: number }[] = [];
  for (let pc = 0; pc < 12; pc++) {
    const rot = (p: number[]) => Array.from({ length: 12 }, (_, i) => p[(i - pc + 12) % 12]);
    scores.push({ pc, minor: false, r: pearson(chroma, rot(MAJOR)) });
    scores.push({ pc, minor: true, r: pearson(chroma, rot(MINOR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  return { ...scores[0], confidence: Math.max(0, scores[0].r - scores[1].r) };
}

function estimateTempo(env: Float32Array, fps: number): number {
  const n = env.length;
  if (n < fps * 4) return 120;
  const minLag = Math.floor((60 * fps) / 200);
  const maxLag = Math.ceil((60 * fps) / 55);
  const acf = new Float32Array(2 * maxLag + 2);
  for (let l = minLag; l < acf.length && l < n; l++) {
    let sum = 0;
    for (let i = 0; i + l < n; i++) sum += env[i] * env[i + l];
    acf[l] = sum / (n - l);
  }
  const score = new Float32Array(maxLag + 2);
  let bestL = minLag, best = -Infinity;
  for (let l = minLag; l <= maxLag; l++) {
    const bpm = (60 * fps) / l;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 118) / 0.85, 2));
    score[l] = (acf[l] + 0.5 * (acf[2 * l] ?? 0)) * prior;
    if (score[l] > best) { best = score[l]; bestL = l; }
  }
  let delta = 0;
  if (bestL > minLag && bestL < maxLag) {
    const a = score[bestL - 1], b = score[bestL], c = score[bestL + 1];
    const d = a - 2 * b + c;
    if (d !== 0) delta = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / d));
  }
  let bpm = (60 * fps) / (bestL + delta);
  while (bpm < 78) bpm *= 2;
  while (bpm >= 160) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

export function analyze(x: Float32Array, sr: number, hintBpm?: number, hintKey?: string): Analysis {
  const s = x.subarray(0, Math.min(x.length, sr * 180));
  const duration = s.length / sr;

  // Waveform overview.
  const BINS = 180;
  const peaks = new Array<number>(BINS).fill(0);
  const per = Math.max(1, Math.floor(s.length / BINS));
  for (let b = 0; b < BINS; b++) {
    let m = 0;
    const end = Math.min(s.length, (b + 1) * per);
    for (let i = b * per; i < end; i += 2) {
      const v = Math.abs(s[i]);
      if (v > m) m = v;
    }
    peaks[b] = m;
  }
  const pmax = Math.max(...peaks, 1e-6);
  for (let b = 0; b < BINS; b++) peaks[b] = Math.round((peaks[b] / pmax) * 1000) / 1000;

  // Onset strength (spectral flux) for tempo and drum activity.
  const N1 = 1024, H1 = 256, w1 = hann(N1), nb1 = N1 / 2;
  const nF1 = Math.max(0, Math.floor((s.length - N1) / H1) + 1);
  const flux = new Float32Array(nF1);
  const lowFlux = new Float32Array(nF1);
  let prev = new Float32Array(nb1), cur = new Float32Array(nb1);
  const re1 = new Float32Array(N1), im1 = new Float32Array(N1);
  const lowBin = Math.ceil((150 * N1) / sr);
  const hiBin = Math.min(nb1, Math.floor((8000 * N1) / sr));
  for (let f = 0; f < nF1; f++) {
    const off = f * H1;
    for (let i = 0; i < N1; i++) re1[i] = s[off + i] * w1[i];
    im1.fill(0);
    fft(re1, im1);
    let fl = 0, lo = 0;
    for (let k = 1; k < hiBin; k++) {
      const m = Math.log1p(100 * Math.sqrt(re1[k] * re1[k] + im1[k] * im1[k]));
      const d = m - prev[k];
      if (d > 0) {
        fl += d;
        if (k <= lowBin) lo += d;
      }
      cur[k] = m;
    }
    flux[f] = fl;
    lowFlux[f] = lo;
    const t = prev; prev = cur; cur = t;
  }
  const fps = sr / H1;
  const env = new Float32Array(nF1);
  {
    const W = 16;
    const prefix = new Float64Array(nF1 + 1);
    for (let i = 0; i < nF1; i++) prefix[i + 1] = prefix[i] + flux[i];
    for (let i = 0; i < nF1; i++) {
      const a = Math.max(0, i - W), b = Math.min(nF1, i + W + 1);
      env[i] = Math.max(0, flux[i] - (prefix[b] - prefix[a]) / (b - a));
    }
  }
  const bpm = hintBpm && hintBpm > 40 ? hintBpm : estimateTempo(env, fps);

  // Chroma for key and tonal content.
  const N2 = 4096, H2 = 2048, w2 = hann(N2), nb2 = N2 / 2;
  const pcOf = new Int8Array(nb2).fill(-1);
  for (let k = 1; k < nb2; k++) {
    const f = (k * sr) / N2;
    if (f >= 60 && f <= 2200) {
      const midi = 69 + 12 * Math.log2(f / 440);
      pcOf[k] = ((Math.round(midi) % 12) + 12) % 12;
    }
  }
  const nF2 = Math.max(0, Math.floor((s.length - N2) / H2) + 1);
  const tonal = new Float32Array(nF2);
  const rms = new Float32Array(nF2);
  const global = new Float64Array(12);
  const re2 = new Float32Array(N2), im2 = new Float32Array(N2);
  const c = new Float64Array(12);
  for (let f = 0; f < nF2; f++) {
    const off = f * H2;
    let e = 0;
    for (let i = 0; i < N2; i++) {
      const v = s[off + i];
      e += v * v;
      re2[i] = v * w2[i];
    }
    rms[f] = Math.sqrt(e / N2);
    im2.fill(0);
    fft(re2, im2);
    c.fill(0);
    for (let k = 1; k < nb2; k++) {
      const pc = pcOf[k];
      if (pc >= 0) c[pc] += Math.sqrt(re2[k] * re2[k] + im2[k] * im2[k]);
    }
    let sum = 0, mx = 0;
    for (let p = 0; p < 12; p++) { sum += c[p]; if (c[p] > mx) mx = c[p]; }
    tonal[f] = sum > 0 ? mx / sum : 0;
    if (sum > 0) for (let p = 0; p < 12; p++) global[p] += (c[p] / sum) * rms[f];
  }

  let key: string, cam: string, keyConfidence: number;
  if (hintKey) {
    key = hintKey;
    cam = "";
    keyConfidence = 1;
  } else {
    const k = estimateKey(global);
    key = keyName(k.pc, k.minor);
    cam = camelot(k.pc, k.minor);
    keyConfidence = Math.round(k.confidence * 1000) / 1000;
  }

  // Score 1–2 bar windows: lots of tonal content, little drum energy.
  const bar = (4 * 60) / bpm;
  let win = 2 * bar, step = bar;
  if (duration < win * 3) { win = bar; step = bar / 2; }
  type Win = { t: number; tonal: number; perc: number; low: number; energy: number };
  const wins: Win[] = [];
  const mean = (arr: Float32Array, a: number, b: number) => {
    a = Math.max(0, a); b = Math.min(arr.length, b);
    if (b <= a) return 0;
    let sum = 0;
    for (let i = a; i < b; i++) sum += arr[i];
    return sum / (b - a);
  };
  for (let t = 0; t + win <= duration + 0.01; t += step) {
    const a1 = Math.floor(t * fps), b1 = Math.floor((t + win) * fps);
    const a2 = Math.floor((t * sr) / H2), b2 = Math.floor(((t + win) * sr) / H2);
    wins.push({
      t,
      tonal: mean(tonal, a2, b2),
      perc: mean(env, a1, b1),
      low: mean(lowFlux, a1, b1),
      energy: mean(rms, a2, b2),
    });
  }
  const maxE = Math.max(...wins.map((w) => w.energy), 1e-9);
  const live = wins.filter((w) => w.energy >= 0.2 * maxE);
  const maxP = Math.max(...live.map((w) => w.perc), 1e-9);
  const maxL = Math.max(...live.map((w) => w.low), 1e-9);
  const minT = Math.min(...live.map((w) => w.tonal), 1);
  const maxT = Math.max(...live.map((w) => w.tonal), 0);
  const scored = live.map((w) => {
    const tN = maxT > minT ? (w.tonal - minT) / (maxT - minT) : 0.5;
    const pN = w.perc / maxP, lN = w.low / maxL;
    return { ...w, pN, score: tN - 0.6 * pN - 0.4 * lN };
  });
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const chosen: typeof scored = [];
  for (const w of sorted) {
    if (chosen.length >= 3) break;
    if (chosen.every((o) => w.t + win <= o.t || w.t >= o.t + win)) chosen.push(w);
  }
  const sMin = Math.min(...scored.map((w) => w.score), 0);
  const sMax = Math.max(...scored.map((w) => w.score), 1e-9);
  const sections: Section[] = chosen
    .map((w) => ({
      start: Math.round(w.t * 100) / 100,
      end: Math.round(Math.min(duration, w.t + win) * 100) / 100,
      score: Math.round(((w.score - sMin) / (sMax - sMin || 1)) * 100) / 100,
    }))
    .sort((a, b) => a.start - b.start);

  const best = sorted[0];
  const melodic = best ? Math.max(0, Math.min(1, ((best.tonal - 0.12) / 0.18) * (1 - 0.5 * best.pN))) : 0;

  return {
    bpm,
    key,
    camelot: cam,
    keyConfidence,
    peaks,
    sections,
    melodic: Math.round(melodic * 100) / 100,
    duration: Math.round(duration * 100) / 100,
  };
}
