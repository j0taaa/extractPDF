import { cookies } from "next/headers";
import { getDb } from "@/db/client";

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const c = await cookies();
    const cookie = c.get("better-auth.session_token");
    if (!cookie?.value) return null;
    const raw = cookie.value.split(".")[0];
    if (!raw) return null;

    const db = getDb() as any;
    const row = await db
      .selectFrom("session")
      .select(["userId"])
      .where("token", "=", raw)
      .executeTakeFirst();
    return row?.userId ?? null;
  } catch {
    return null;
  }
}

