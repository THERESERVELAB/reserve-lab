// Copies the on-device OCR engine into public/ocr so lab photos and scanned
// reports are read in the member's browser without fetching anything from a
// third-party CDN. Runs before `next dev` and `next build`; the output is
// generated and gitignored.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");

const tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
const engDir = dirname(require.resolve("@tesseract.js-data/eng/package.json"));

const files = [
  [join(tesseractDir, "dist", "worker.min.js"), join(out, "worker.min.js")],
  // LSTM-only cores: plain, SIMD and relaxed SIMD. The worker picks the one the browser supports.
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((name) => [
    join(coreDir, name),
    join(out, "core", name),
  ]),
  // Compact English model. The worker requests `${langPath}/eng.traineddata.gz`.
  [join(engDir, "4.0.0_best_int", "eng.traineddata.gz"), join(out, "lang", "eng.traineddata.gz")],
  // Apache-2.0 travels with the files it covers. Notices: /open-source.
  [join(tesseractDir, "LICENSE.md"), join(out, "LICENSE-tesseract.js.txt")],
  [join(coreDir, "LICENSE"), join(out, "core", "LICENSE-tesseract.js-core.txt")],
];

let copied = 0;
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`[ocr-assets] missing ${from} — run npm install`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied += 1;
}
console.log(`[ocr-assets] ${copied ? `copied ${copied} file(s)` : "up to date"} → public/ocr`);
