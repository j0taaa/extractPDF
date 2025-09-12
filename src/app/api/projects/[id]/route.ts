import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb() as any;
  const row = await db
    .selectFrom("project")
    .select(["id", "name", "description", "ownerId", "createdAt", "updatedAt"])
    .where("id", "=", params.id)
    .where("ownerId", "=", userId)
    .executeTakeFirst();
  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(row);
}

