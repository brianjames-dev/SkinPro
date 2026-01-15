import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { createCanvas } from "@napi-rs/canvas";

const require = createRequire(import.meta.url);

const pdfPath = process.argv[2];
const scaleArg = process.argv[3];
const outputPath = process.argv[4];
const scale = Number.parseFloat(scaleArg ?? "2");

if (!pdfPath || !outputPath) {
  console.error("Missing pdf path");
  process.exit(1);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.mjs"
);
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const standardFontDataUrl = pathToFileURL(
  path.join(pdfjsDir, "standard_fonts/")
).href;
const cMapUrl = pathToFileURL(path.join(pdfjsDir, "cmaps/")).href;

const pdfBuffer = await fs.promises.readFile(pdfPath);
const pdf = await pdfjs.getDocument({
  data: new Uint8Array(pdfBuffer),
  disableWorker: true,
  standardFontDataUrl,
  cMapUrl,
  cMapPacked: true,
  useSystemFonts: true,
  disableFontFace: false
}).promise;
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: Number.isFinite(scale) ? scale : 2 });
const canvas = createCanvas(viewport.width, viewport.height);
const context = canvas.getContext("2d");
await page.render({ canvasContext: context, viewport }).promise;
const pngBuffer = canvas.toBuffer("image/png");

await fs.promises.writeFile(outputPath, pngBuffer);
