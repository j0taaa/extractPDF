import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { aggregateResultsByFolder } from "@/lib/processing-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb() as any;
  const project = await db
    .selectFrom("project")
    .select(["id", "ownerId"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const nodes = await aggregateResultsByFolder(id);
  return Response.json({ nodes });
}
