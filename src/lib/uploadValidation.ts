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
    if (!mimeType && !nameExt) {
      return {
        ok: false,
        error: `"${file.name || "File"}" has an unknown file type.`
      };
    }

    if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return {
        ok: false,
        error: `"${file.name || "File"}" has an unsupported file type.`
      };
    }

    const ext = nameExt || guessExtension(file.name, mimeType);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        error: `"${file.name || "File"}" has an unsupported file extension.`
      };
    }
  }

  return { ok: true, totalBytes };
};
