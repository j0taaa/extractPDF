import path from "path";

import type { FileType } from "./instruction-sets";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".webp",
  ".heic",
  ".heif"
]);

const IMAGE_FILE_DESCRIPTION = "image files (JPEG, PNG, GIF, WebP, BMP, TIFF, or HEIC)";

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateFileForProjectType(
  fileName: string | undefined,
  mimeType: string | null | undefined,
  projectType: FileType
): FileValidationResult {
  const normalizedMime = (mimeType ?? "").toLowerCase();
  const extension = path.extname(fileName ?? "").toLowerCase();

  if (projectType === "pdf") {
    const isPdfMime = normalizedMime === "application/pdf";
    const isPdfExtension = extension === ".pdf";
    if (isPdfMime || isPdfExtension) {
      return { ok: true };
    }
    return { ok: false, message: "This project only accepts PDF files." };
  }

  if (projectType === "image") {
    const isImageMime = normalizedMime.startsWith("image/");
    const isImageExtension = IMAGE_EXTENSIONS.has(extension);
    if (isImageMime || isImageExtension) {
      return { ok: true };
    }
    return { ok: false, message: `This project only accepts ${IMAGE_FILE_DESCRIPTION}.` };
  }

  return { ok: true };
}
