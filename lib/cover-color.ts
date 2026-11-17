"use client";

/** The most colourful hue in a cover, as a bright accent that reads on the dark UI. */
const cache = new Map<string, string | null>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 32, 32);
  return ctx.getImageData(0, 0, 32, 32).data; // throws if the image isn't readable
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function pick(data: Uint8ClampedArray): string | null {
  // Weight each hue by how colourful and how visible its pixels are.
  const bins = Array.from({ length: 24 }, () => ({ w: 0, h: 0, s: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.2 || l < 0.12 || l > 0.92) continue;
    const w = s * s * (1 - Math.abs(l - 0.5) * 1.4);
    const b = bins[Math.floor(h / 15) % 24];
    b.w += w;
    b.h += h * w;
    b.s += s * w;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 1.5) return null; // a black-and-white cover: keep your own accent
  const h = best.h / best.w;
  const s = Math.max(0.6, Math.min(0.9, best.s / best.w));
  return hslToHex(h, s, 0.6);
}

export async function coverColor(url: string): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!;
  let color: string | null = null;
  try {
    color = pick(pixels(await loadImage(url)));
  } catch {
    try {
      color = pick(pixels(await loadImage(`/api/img?u=${encodeURIComponent(url)}`)));
    } catch {
      color = null;
    }
  }
  cache.set(url, color);
  return color;
}
