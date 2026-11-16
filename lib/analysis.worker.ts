import { analyze } from "./dsp";

const ctx = self as unknown as {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const { id, samples, sr, hintBpm, hintKey } = e.data as {
    id: number;
    samples: Float32Array;
    sr: number;
    hintBpm?: number;
    hintKey?: string;
  };
  try {
    ctx.postMessage({ id, res: analyze(samples, sr, hintBpm, hintKey) });
  } catch (err) {
    ctx.postMessage({ id, error: String(err) });
  }
};
