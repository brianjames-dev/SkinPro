import path from "path";
import { guessExtension } from "@/lib/fileUtils";

const MB = 1024 * 1024;

export type UploadLimits = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
};

export const PHOTO_UPLOAD_LIMITS: UploadLimits = {
  maxFiles: 20,
  maxFileBytes: 12 * MB,
  maxTotalBytes: 150 * MB
};

export const PROFILE_UPLOAD_LIMITS: UploadLimits = {
  maxFiles: 1,
  maxFileBytes: 8 * MB,
  maxTotalBytes: 8 * MB
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif"
]);

const formatMegabytes = (bytes: number) =>
  `${Math.max(1, Math.round(bytes / MB))} MB`;

export type ImageValidationResult =
  | { ok: true; totalBytes: number }
  | { ok: false; error: string };

/** Best-effort magic-byte sniff for common image formats (incl. HEIC ftyp). */
export const hasImageMagicBytes = (buffer: Buffer): boolean => {
  if (buffer.length < 12) {
    return false;
  }
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }
  // HEIC/HEIF: ....ftyp....
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (
      brand.startsWith("heic") ||
      brand.startsWith("heif") ||
      brand.startsWith("mif1") ||
      brand.startsWith("msf1") ||
      brand.startsWith("avif")
    ) {
      return true;
    }
  }
  return false;
};

export const validateImageFiles = (
  files: File[],
  limits: UploadLimits
): ImageValidationResult => {
  if (!files.length) {
    return { ok: false, error: "No files selected." };
  }

  if (files.length > limits.maxFiles) {
    return {
      ok: false,
      error: `Too many files. Max ${limits.maxFiles} per upload.`
    };
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;

    if (file.size > limits.maxFileBytes) {
      return {
        ok: false,
        error: `"${file.name || "File"}" exceeds ${formatMegabytes(
          limits.maxFileBytes
        )}.`
      };
    }

    if (totalBytes > limits.maxTotalBytes) {
      return {
        ok: false,
        error: `Total upload exceeds ${formatMegabytes(limits.maxTotalBytes)}.`
      };
    }

    const mimeType = (file.type || "").toLowerCase();
    const nameExt = path.extname(file.name || "").toLowerCase();

    if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return {
        ok: false,
        error: `"${file.name || "File"}" has an unsupported file type.`
      };
    }

    // Require a concrete allowed extension (from name or MIME), never empty-type alone.
    const ext = nameExt || (mimeType ? guessExtension(file.name, mimeType) : "");
    if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        error: `"${file.name || "File"}" has an unsupported file extension.`
      };
    }
  }

  return { ok: true, totalBytes };
};
