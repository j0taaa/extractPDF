import { generateId } from "better-auth";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { persistProjectFile } from "@/lib/storage";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per upload

type Params = { params: Promise<{ id: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
};

type ProjectFileRow = {
  id: string;
  originalName: string;
  size: string | number;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: Date | string;
};

function normalizeFileRow(row: ProjectFileRow) {
  return {
    id: row.id,
    originalName: row.originalName,
    size: typeof row.size === "string" ? Number(row.size) : row.size,
    contentType: row.contentType,
    uploadedViaApi: row.uploadedViaApi,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString()
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId"])
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

  return Response.json(files.map(normalizeFileRow));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId"])
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
  if (upload.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({ error: "File exceeds size limit" }, { status: 413 });
  }

  const { relativePath } = await persistProjectFile(project.id, upload);

  const fileId = generateId();
  await db
    .insertInto("projectFile")
    .values({
      id: fileId,
      projectId: project.id,
      ownerId: userId,
      originalName: upload.name,
      storagePath: relativePath,
      contentType: upload.type || null,
      size: BigInt(upload.size),
      uploadedViaApi: false
    })
    .executeTakeFirst();

  return Response.json(
    normalizeFileRow({
      id: fileId,
      originalName: upload.name,
      size: upload.size,
      contentType: upload.type || null,
      uploadedViaApi: false,
      createdAt: new Date()
    })
  );
}
