import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { createCanvas } from "@napi-rs/canvas";

const require = createRequire(import.meta.url);

const pdfPath = process.argv[2];
const scaleArg = process.argv[3];
const outputPath = process.argv[4];
const cropToContent = process.argv.includes("--crop-content");
const scale = Number.parseFloat(scaleArg ?? "2");

if (!pdfPath || !outputPath) {
  console.error("Missing pdf path");
  process.exit(1);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
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

const findContentBounds = (sourceCanvas) => {
  const sourceContext = sourceCanvas.getContext("2d");
  const { width, height } = sourceCanvas;
  const { data } = sourceContext.getImageData(0, 0, width, height);
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) {
        continue;
      }

      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const isContent = red < 235 || green < 235 || blue < 235;
      if (!isContent) {
        continue;
      }

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (left > right || top > bottom) {
    return null;
  }

  const margin = Math.round(24 * (Number.isFinite(scale) ? scale : 2));
  return {
    left: Math.max(0, left - margin),
    top: Math.max(0, top - margin),
    width: Math.min(width, right + margin) - Math.max(0, left - margin) + 1,
    height: Math.min(height, bottom + margin) - Math.max(0, top - margin) + 1
  };
};

const outputCanvas = cropToContent
  ? (() => {
      const bounds = findContentBounds(canvas);
      if (!bounds) {
        return canvas;
      }
      const cropped = createCanvas(bounds.width, bounds.height);
      const croppedContext = cropped.getContext("2d");
      croppedContext.fillStyle = "#ffffff";
      croppedContext.fillRect(0, 0, bounds.width, bounds.height);
      croppedContext.drawImage(
        canvas,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      return cropped;
    })()
  : canvas;

const pngBuffer = outputCanvas.toBuffer("image/png");

await fs.promises.writeFile(outputPath, pngBuffer);
