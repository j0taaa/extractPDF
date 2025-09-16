import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const db = getDb() as any;
    const record = await db
      .selectFrom("user")
      .select(["id", "name", "email", "image"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!record) {
      return NextResponse.json({ user: null });
    }

    const user = {
      id: record.id as string,
      name: (record.name as string | null) ?? null,
      email: record.email as string,
      image: (record.image as string | null) ?? null
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to fetch current user", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
