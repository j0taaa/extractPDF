import { sql } from "kysely";
import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import {
  clampTokenSafetyLimit,
  MAX_TOKEN_SAFETY_LIMIT,
  MIN_TOKEN_SAFETY_LIMIT,
  parseTokenSafetyLimit
} from "@/lib/token-limit";
import { getDefaultTokenSafetyLimit } from "@/lib/server-token-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb() as any;
  const row = await db
    .selectFrom("project")
    .select([
      "id",
      "name",
      "description",
      "fileType",
      "instructionSet",
      "customPrompt",
      "ownerId",
      "createdAt",
      "updatedAt",
      "tokenSafetyLimit"
    ])
    .where("id", "=", id)
    .where("ownerId", "=", userId)
    .executeTakeFirst();
  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(row);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "A JSON body is required." }, { status: 400 });
  }

  const rawLimit = (payload as Record<string, unknown>).tokenSafetyLimit;
  let nextLimit: number | null = null;

  if (rawLimit !== undefined) {
    let numeric: number | null = null;
    if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
      numeric = rawLimit;
    } else if (typeof rawLimit === "string" && rawLimit.trim()) {
      const parsed = Number.parseInt(rawLimit, 10);
      numeric = Number.isFinite(parsed) ? parsed : null;
    }

    if (numeric === null) {
      return Response.json(
        { error: "Token safety limit must be a numeric value." },
        { status: 400 }
      );
    }

    nextLimit = clampTokenSafetyLimit(numeric);
  }

  if (nextLimit === null) {
    return Response.json({ error: "No supported fields were provided." }, { status: 400 });
  }

  const db = getDb() as any;
  const project = await db
    .selectFrom("project")
    .select(["id", "ownerId", "tokenSafetyLimit"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const previousLimit = parseTokenSafetyLimit(
    project.tokenSafetyLimit,
    getDefaultTokenSafetyLimit()
  );

  if (Number.isFinite(previousLimit) && clampTokenSafetyLimit(previousLimit) === nextLimit) {
    return Response.json({ tokenSafetyLimit: nextLimit });
  }

  await db
    .updateTable("project")
    .set({ tokenSafetyLimit: nextLimit, updatedAt: sql`now()` })
    .where("id", "=", id)
    .executeTakeFirst();

  const clampedMin = MIN_TOKEN_SAFETY_LIMIT;
  const clampedMax = MAX_TOKEN_SAFETY_LIMIT;
  const defaultLimit = getDefaultTokenSafetyLimit();

  return Response.json({
    tokenSafetyLimit: nextLimit,
    defaults: {
      min: clampedMin,
      max: clampedMax,
      fallback: defaultLimit
    }
  });
}

