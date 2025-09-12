import { getDb } from "@/db/client";
import { generateId } from "better-auth";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb() as any;
  const rows = await db
    .selectFrom("project")
    .select(["id", "name", "description"])
    .where("ownerId", "=", userId)
    .orderBy("createdAt", "desc")
    .execute();
  return Response.json(rows);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  const description = (body?.description ?? "").trim();
  if (!name) return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });

  const id = generateId();
  const db = getDb() as any;
  await db
    .insertInto("project")
    .values({ id, ownerId: userId, name, description })
    .executeTakeFirst();
  return Response.json({ id, name, description });
}

