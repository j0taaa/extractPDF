import { getDb } from "@/db/client";
import { generateId } from "better-auth";
import { getCurrentUserId } from "@/lib/auth";
import { getDefaultTokenSafetyLimit } from "@/lib/server-token-limit";
import {
  DEFAULT_INSTRUCTION_SET_ID,
  FILE_TYPES,
  isFileType,
  isInstructionSetId
} from "@/lib/instruction-sets";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb() as any;
  const rows = await db
    .selectFrom("project")
    .select(["id", "name", "description", "fileType", "instructionSet", "customPrompt"])
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
  const requestedFileType = body?.fileType;
  const requestedInstructionSet = body?.instructionSet;
  const customPrompt = typeof body?.customPrompt === "string" ? body.customPrompt.trim() : null;
  if (!name) return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });

  const fileType = isFileType(requestedFileType) ? requestedFileType : FILE_TYPES[0].id;
  const instructionSet = isInstructionSetId(requestedInstructionSet)
    ? requestedInstructionSet
    : DEFAULT_INSTRUCTION_SET_ID;

  const id = generateId();
  const db = getDb() as any;
  await db
    .insertInto("project")
    .values({
      id,
      ownerId: userId,
      name,
      description,
      fileType,
      instructionSet,
      customPrompt: customPrompt || null,
      tokenSafetyLimit: getDefaultTokenSafetyLimit()
    })
    .executeTakeFirst();
  return Response.json({ id, name, description, fileType, instructionSet, customPrompt });
}

