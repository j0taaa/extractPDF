import { randomBytes } from "crypto";
import { sql } from "kysely";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

type ProjectRow = {
  id: string;
  ownerId: string;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
};

function createToken(): string {
  return randomBytes(24).toString("hex");
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "apiIngestionEnabled", "apiToken"])
    .where("id", "=", id)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const shouldEnable =
    typeof payload.apiIngestionEnabled === "boolean"
      ? payload.apiIngestionEnabled
      : project.apiIngestionEnabled;
  const regenerate = payload.regenerateToken === true;

  let token = project.apiToken;
  const updates: Record<string, unknown> = {};

  if (shouldEnable !== project.apiIngestionEnabled) {
    updates.apiIngestionEnabled = shouldEnable;
  }

  if (regenerate || (shouldEnable && !token)) {
    token = createToken();
    updates.apiToken = token;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({
      apiIngestionEnabled: project.apiIngestionEnabled,
      apiToken: project.apiToken
    });
  }

  await db
    .updateTable("project")
    .set({
      ...updates,
      updatedAt: sql`now()`
    })
    .where("id", "=", id)
    .executeTakeFirst();

  return Response.json({
    apiIngestionEnabled: shouldEnable,
    apiToken: token
  });
}
