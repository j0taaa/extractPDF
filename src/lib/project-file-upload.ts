import path from "path";

import JSZip from "jszip";
import { generateId } from "better-auth";

import { getDb } from "@/db/client";
import { validateFileForProjectType } from "@/lib/files";
import type { FileType } from "@/lib/instruction-sets";
import { enqueueProcessingRun } from "@/lib/processing-queue";
import { queueProcessingForFile } from "@/lib/processing-service";
import { persistProjectFile } from "@/lib/storage";

export class UploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

const ZIP_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
  "application/x-zip"
]);

const MIME_BY_EXTENSION = new Map<string, string>([
  [".pdf", "application/pdf"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"]
]);

export type NormalizedProjectFile = {
  id: string;
  originalName: string;
  size: number;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: string;
};

export type UploadOutcome = {
  files: NormalizedProjectFile[];
  processingRunIds: string[];
  warnings: string[];
};

type ProjectFileRow = {
  id: string;
  originalName: string;
  size: string | number | bigint;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: Date | string;
};

type StoreFileParams = {
  db: any;
  projectId: string;
  ownerId: string;
  file: File;
  originalName: string;
  uploadedViaApi: boolean;
  triggeredBy: string;
};

type StoreFileResult = {
  file: NormalizedProjectFile;
  processingRunId: string | null;
};

type ArchiveExtractionEntry = {
  file: File;
  originalName: string;
};

type ArchiveExtractionResult = {
  entries: ArchiveExtractionEntry[];
  warnings: string[];
};

function normalizeFileRow(row: ProjectFileRow): NormalizedProjectFile {
  const rawSize =
    typeof row.size === "string"
      ? Number(row.size)
      : typeof row.size === "bigint"
        ? Number(row.size)
        : row.size;
  const size = Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : 0;
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString();

  return {
    id: row.id,
    originalName: row.originalName,
    size,
    contentType: row.contentType,
    uploadedViaApi: row.uploadedViaApi,
    createdAt
  };
}

function isZipArchive(fileName: string | undefined, mimeType: string | null | undefined): boolean {
  const normalizedMime = (mimeType ?? "").toLowerCase();
  if (ZIP_MIME_TYPES.has(normalizedMime)) {
    return true;
  }
  const extension = path.extname(fileName ?? "").toLowerCase();
  return extension === ".zip";
}

function guessMimeType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION.get(extension) ?? null;
}

async function extractArchiveEntries(
  file: File,
  projectType: FileType,
  maxSizeBytes: number
): Promise<ArchiveExtractionResult> {
  const warnings: string[] = [];
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(await file.arrayBuffer());
  } catch (error) {
    throw new UploadError("Unable to read the uploaded ZIP archive.", 400);
  }

  const entries: ArchiveExtractionEntry[] = [];

  for (const entry of Object.values(archive.files)) {
    if (!entry || entry.dir) {
      continue;
    }
    const normalizedPath = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedPath) {
      continue;
    }

    const mimeType = guessMimeType(normalizedPath);
    const validation = validateFileForProjectType(normalizedPath, mimeType, projectType);
    if (!validation.ok) {
      warnings.push(`Skipped ${normalizedPath}: ${validation.message}`);
      continue;
    }

    const content = await entry.async("uint8array");
    if (content.byteLength > maxSizeBytes) {
      const sizeMb = (content.byteLength / (1024 * 1024)).toFixed(2);
      warnings.push(`Skipped ${normalizedPath}: file exceeds ${sizeMb} MB which is above the limit.`);
      continue;
    }

    const buffer = content.slice().buffer;
    const entryFile = new File([buffer], path.basename(normalizedPath), {
      type: mimeType ?? "",
      lastModified: Date.now()
    });

    entries.push({
      file: entryFile,
      originalName: normalizedPath
    });
  }

  return { entries, warnings };
}

async function storeFile({
  db,
  projectId,
  ownerId,
  file,
  originalName,
  uploadedViaApi,
  triggeredBy
}: StoreFileParams): Promise<StoreFileResult> {
  const { relativePath } = await persistProjectFile(projectId, file, path.basename(originalName));
  const fileId = generateId();

  await db
    .insertInto("projectFile")
    .values({
      id: fileId,
      projectId,
      ownerId,
      originalName,
      storagePath: relativePath,
      contentType: file.type || null,
      size: BigInt(file.size),
      uploadedViaApi
    })
    .executeTakeFirst();

  let processingRunId: string | null = null;
  try {
    const run = await queueProcessingForFile({
      projectId,
      fileId,
      triggeredBy
    });
    if (run?.runId) {
      processingRunId = run.runId;
      enqueueProcessingRun(run.runId);
    }
  } catch (error) {
    console.error("Failed to enqueue processing run", error);
  }

  const normalized = normalizeFileRow({
    id: fileId,
    originalName,
    size: file.size,
    contentType: file.type || null,
    uploadedViaApi,
    createdAt: new Date()
  });

  return { file: normalized, processingRunId };
}

export async function saveProjectUpload(options: {
  projectId: string;
  ownerId: string;
  projectType: FileType;
  upload: File;
  uploadedViaApi: boolean;
  triggeredBy: string;
  maxFileSizeBytes: number;
}): Promise<UploadOutcome> {
  const { projectId, ownerId, projectType, upload, uploadedViaApi, triggeredBy, maxFileSizeBytes } = options;
  const db = getDb() as any;

  if (isZipArchive(upload.name, upload.type)) {
    const { entries, warnings } = await extractArchiveEntries(upload, projectType, maxFileSizeBytes);

    if (!entries.length) {
      const message =
        warnings.length > 0
          ? "The archive was processed but no supported files were found."
          : "The archive did not contain any compatible files for this project.";
      throw new UploadError(message, 400);
    }

    const results: StoreFileResult[] = [];
    for (const entry of entries) {
      results.push(
        await storeFile({
          db,
          projectId,
          ownerId,
          file: entry.file,
          originalName: entry.originalName,
          uploadedViaApi,
          triggeredBy
        })
      );
    }

    return {
      files: results.map((result) => result.file),
      processingRunIds: results
        .map((result) => result.processingRunId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
      warnings
    };
  }

  if (upload.size > maxFileSizeBytes) {
    throw new UploadError("File exceeds size limit", 413);
  }

  const validation = validateFileForProjectType(upload.name, upload.type, projectType);
  if (!validation.ok) {
    throw new UploadError(validation.message, 415);
  }

  const result = await storeFile({
    db,
    projectId,
    ownerId,
    file: upload,
    originalName: upload.name,
    uploadedViaApi,
    triggeredBy
  });

  return {
    files: [result.file],
    processingRunIds: result.processingRunId ? [result.processingRunId] : [],
    warnings: []
  };
}

export { normalizeFileRow as normalizeProjectFileRow };
