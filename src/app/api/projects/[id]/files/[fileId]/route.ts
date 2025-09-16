import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { readStoredFile, removeStoredFile } from "@/lib/storage";
import { cancelRunsForFile } from "@/lib/processing-service";

type Params = { params: Promise<{ id: string; fileId: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
};

type ProjectFileRow = {
  id: string;
  projectId: string;
  storagePath: string;
  originalName: string;
  contentType: string | null;
  size: string | number | bigint;
};

function normalizeSize(size: ProjectFileRow["size"]): number {
  if (typeof size === "number") return size;
  if (typeof size === "bigint") return Number(size);
  const parsed = Number(size);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildContentDisposition(originalName: string, disposition: "inline" | "attachment"): string {
  const fallback = originalName || "file";
  const sanitized = fallback.replace(/["\r\n]/g, "_");
  const safeName = sanitized || "file";
  const encoded = encodeURIComponent(safeName);
  return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
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

  const file = (await db
    .selectFrom("projectFile")
    .select(["id", "projectId", "storagePath", "originalName", "contentType", "size"])
    .where("projectId", "=", project.id)
    .where("id", "=", fileId)
    .executeTakeFirst()) as ProjectFileRow | undefined;

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  let fileContent: Buffer | null = null;
  try {
    fileContent = await readStoredFile(file.storagePath);
  } catch (error) {
    console.error("Failed to read stored file", error);
    return Response.json({ error: "Unable to read the stored file." }, { status: 500 });
  }

  if (!fileContent) {
    return Response.json({ error: "This file is no longer available." }, { status: 410 });
  }

  const headers = new Headers();
  headers.set("Content-Type", file.contentType ?? "application/octet-stream");
  const size = normalizeSize(file.size);
  if (size > 0 && Number.isFinite(size)) {
    headers.set("Content-Length", size.toString());
  }
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  const downloadFlag = request.nextUrl.searchParams.get("download");
  const shouldDownload =
    downloadFlag !== null && downloadFlag.toLowerCase() !== "false" && downloadFlag !== "0";
  const disposition = shouldDownload ? "attachment" : "inline";
  headers.set("Content-Disposition", buildContentDisposition(file.originalName, disposition));

  const body = new Uint8Array(fileContent);
  return new Response(body, { headers });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
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

  const file = (await db
    .selectFrom("projectFile")
    .select(["id", "storagePath"])
    .where("projectId", "=", project.id)
    .where("id", "=", fileId)
    .executeTakeFirst()) as { id: string; storagePath: string } | undefined;

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await removeStoredFile(file.storagePath);
  } catch (error) {
    console.error("Failed to delete stored file", error);
    return Response.json({ error: "Unable to remove the stored file." }, { status: 500 });
  }

  await cancelRunsForFile(file.id);

  await db
    .deleteFrom("projectFile")
    .where("id", "=", file.id)
    .executeTakeFirst();

  return new Response(null, { status: 204 });
}
