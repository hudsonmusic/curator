// Copies ONNX Runtime's WebAssembly files into public/ so the style model runs
// from this site (no CDN). Runs after npm install.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("onnxruntime-web/wasm")), ".");
mkdirSync("public/ort", { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) copyFileSync(join(dist, f), join("public/ort", f));
console.log("copied onnxruntime-web wasm to public/ort");
