import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import type { FileType } from "@/lib/instruction-sets";
import {
  saveProjectUpload,
  UploadError
} from "@/lib/project-file-upload";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
  fileType: FileType;
};

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ", 2);
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token.trim();
    }
  }
  const headerToken = request.headers.get("x-api-token");
  if (headerToken?.trim()) {
    return headerToken.trim();
  }
  return null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = extractToken(request);
  if (!token) {
    return Response.json({ error: "Missing API token" }, { status: 401 });
  }

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "apiIngestionEnabled", "apiToken", "fileType"])
    .where("id", "=", id)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project || !project.apiIngestionEnabled || !project.apiToken || project.apiToken !== token) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
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
      ownerId: project.ownerId,
      projectType: project.fileType,
      upload,
      uploadedViaApi: true,
      triggeredBy: "api_ingest",
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
    console.error("Failed to process API ingestion upload", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
