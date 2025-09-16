import { generateId } from "better-auth";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { persistProjectFile } from "@/lib/storage";
import { validateFileForProjectType } from "@/lib/files";
import type { FileType } from "@/lib/instruction-sets";
import { queueProcessingForFile } from "@/lib/processing-service";
import { enqueueProcessingRun } from "@/lib/processing-queue";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
  fileType: FileType;
};

type ProjectFileRow = {
  id: string;
  originalName: string;
  size: number;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: Date;
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

function normalizeFileRow(row: ProjectFileRow) {
  return {
    id: row.id,
    originalName: row.originalName,
    size: row.size,
    contentType: row.contentType,
    uploadedViaApi: row.uploadedViaApi,
    createdAt: row.createdAt.toISOString()
  };
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
  if (upload.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({ error: "File exceeds size limit" }, { status: 413 });
  }

  const validation = validateFileForProjectType(upload.name, upload.type, project.fileType);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 415 });
  }

  const { relativePath } = await persistProjectFile(project.id, upload);

  const fileId = generateId();
  await db
    .insertInto("projectFile")
    .values({
      id: fileId,
      projectId: project.id,
      ownerId: project.ownerId,
      originalName: upload.name,
      storagePath: relativePath,
      contentType: upload.type || null,
      size: BigInt(upload.size),
      uploadedViaApi: true
    })
    .executeTakeFirst();

  let processingRunId: string | null = null;
  try {
    const run = await queueProcessingForFile({
      projectId: project.id,
      fileId,
      triggeredBy: "api_ingest"
    });
    if (run?.runId) {
      processingRunId = run.runId;
      enqueueProcessingRun(run.runId);
    }
  } catch (error) {
    console.error("Failed to enqueue processing run", error);
  }

  const payload = {
    ...normalizeFileRow({
      id: fileId,
      originalName: upload.name,
      size: upload.size,
      contentType: upload.type || null,
      uploadedViaApi: true,
      createdAt: new Date()
    }),
    processingRunId
  };

  return Response.json(payload);
}
