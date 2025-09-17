import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import type { FileType } from "@/lib/instruction-sets";
import {
  normalizeProjectFileRow,
  saveProjectUpload,
  UploadError
} from "@/lib/project-file-upload";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per upload

type Params = { params: Promise<{ id: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
  fileType: FileType;
};

type ProjectFileRow = {
  id: string;
  originalName: string;
  size: string | number | bigint;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: Date | string;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "fileType"])
    .where("id", "=", id)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const files = (await db
    .selectFrom("projectFile")
    .select(["id", "originalName", "size", "contentType", "uploadedViaApi", "createdAt"])
    .where("projectId", "=", id)
    .orderBy("createdAt", "desc")
    .execute()) as ProjectFileRow[];

  return Response.json(files.map(normalizeProjectFileRow));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "fileType"])
    .where("id", "=", id)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  const upload = file as File;
  try {
    const outcome = await saveProjectUpload({
      projectId: project.id,
      ownerId: userId,
      projectType: project.fileType,
      upload,
      uploadedViaApi: false,
      triggeredBy: userId,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES
    });

    const primaryRunId = outcome.processingRunIds[0] ?? null;

    return Response.json({
      file: outcome.files[0] ?? null,
      files: outcome.files,
      processingRunId: primaryRunId,
      processingRunIds: outcome.processingRunIds,
      warnings: outcome.warnings
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to upload project files", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
