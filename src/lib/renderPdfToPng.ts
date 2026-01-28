import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export const renderPdfToPng = async (pdfPath: string, scale = 3) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "skinpro-pdf-")
  );
  const outputPath = path.join(tempDir, "render.png");
  const scriptPath = path.resolve(
    process.cwd(),
    "scripts",
    "render-pdf-to-png.mjs"
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [scriptPath, pdfPath, `${scale}`, outputPath],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
      const errors: Buffer[] = [];
      child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(errors).toString() || "Unknown error";
          reject(new Error(`renderer exited ${code}: ${stderr}`));
          return;
        }
        resolve();
      });
    });

    return await fs.promises.readFile(outputPath);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
};
