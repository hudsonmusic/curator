/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/wasm";
import { MEL_BANDS, PATCH, melPatches } from "./mel";

/**
 * Runs Essentia's Discogs-EffNet in the browser: 16 kHz audio in, the 400 Discogs
 * style scores and a 1280-number sound embedding out (both averaged over the clip).
 */
const MODEL_URL = "/models/discogs-effnet-bsdynamic-1.onnx";
ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1;

let session: Promise<ort.InferenceSession> | null = null;

async function loadModel(): Promise<ArrayBuffer> {
  // Keep the 18 MB model in Cache Storage so it downloads once.
  try {
    const cache = await caches.open("curator-models-v1");
    const hit = await cache.match(MODEL_URL);
    if (hit) return hit.arrayBuffer();
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`model ${res.status}`);
    await cache.put(MODEL_URL, res.clone());
    return res.arrayBuffer();
  } catch {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`model ${res.status}`);
    return res.arrayBuffer();
  }
}

function getSession() {
  session ??= loadModel().then((buf) => ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"] }));
  return session;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, samples } = e.data as { id: number; samples: Float32Array };
  try {
    const s = await getSession();
    // At most ~60 s of audio (enough for a preview or a good chunk of a song).
    const { data, count } = melPatches(samples.subarray(0, 16000 * 60));
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", data, [count, PATCH, MEL_BANDS]) });
    const pred = out[s.outputNames[0]].data as Float32Array;
    const emb = out[s.outputNames[1]].data as Float32Array;
    const scores = new Float32Array(400);
    const vec = new Float32Array(1280);
    for (let p = 0; p < count; p++) {
      for (let i = 0; i < 400; i++) scores[i] += pred[p * 400 + i] / count;
      for (let i = 0; i < 1280; i++) vec[i] += emb[p * 1280 + i] / count;
    }
    (self as unknown as Worker).postMessage({ id, scores, emb: vec }, [scores.buffer, vec.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
